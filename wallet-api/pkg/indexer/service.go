package indexer

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// balanceOfABI is the ABI for ERC-20 balanceOf(address).
var balanceOfABI abi.ABI

func init() {
	parsed, err := abi.JSON(strings.NewReader(`[{
		"name":"balanceOf","type":"function","stateMutability":"view",
		"inputs":[{"name":"account","type":"address"}],
		"outputs":[{"name":"","type":"uint256"}]
	}]`))
	if err != nil {
		panic("indexer: parse balanceOf ABI: " + err.Error())
	}
	balanceOfABI = parsed
}

// rpcURLs maps chain name to Alchemy JSON-RPC URL.
// Populated from config at service creation.
type rpcConfig struct {
	eth      string
	polygon  string
	arbitrum string
	base     string
	optimism string
}

// alchemyActivityPayload is the top-level shape of an Alchemy address-activity webhook.
type alchemyActivityPayload struct {
	WebhookID   string             `json:"webhookId"`
	ID          string             `json:"id"`
	CreatedAt   time.Time          `json:"createdAt"`
	Type        string             `json:"type"`
	Event       alchemyEvent       `json:"event"`
}

type alchemyEvent struct {
	Network  string             `json:"network"`
	Activity []alchemyActivity  `json:"activity"`
}

type alchemyActivity struct {
	FromAddress string      `json:"fromAddress"`
	ToAddress   string      `json:"toAddress"`
	BlockNum    string      `json:"blockNum"`
	Hash        string      `json:"hash"`
	Value       float64     `json:"value"`
	Asset       string      `json:"asset"`
	Category    string      `json:"category"`
	RawContract rawContract `json:"rawContract"`
}

type rawContract struct {
	RawValue string `json:"rawValue"`
	Address  string `json:"address"`
	Decimal  string `json:"decimal"`
}

type Service struct {
	db            *pgxpool.Pool
	rdb           *redis.Client
	webhookSecret string
	rpc           rpcConfig
	sseBus        *SSEBus
}

type Config struct {
	WebhookSecret      string
	AlchemyEthURL      string
	AlchemyPolyURL     string
	AlchemyArbitrumURL string
	AlchemyBaseURL     string
	AlchemyOptimismURL string
}

func NewService(db *pgxpool.Pool, rdb *redis.Client, cfg Config) *Service {
	return &Service{
		db:            db,
		rdb:           rdb,
		webhookSecret: cfg.WebhookSecret,
		rpc: rpcConfig{
			eth:      cfg.AlchemyEthURL,
			polygon:  cfg.AlchemyPolyURL,
			arbitrum: cfg.AlchemyArbitrumURL,
			base:     cfg.AlchemyBaseURL,
			optimism: cfg.AlchemyOptimismURL,
		},
		sseBus:        NewSSEBus(),
	}
}

func (s *Service) SSEBus() *SSEBus { return s.sseBus }

// HandleAlchemyWebhook verifies the HMAC signature and processes address-activity events.
func (s *Service) HandleAlchemyWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		http.Error(w, "read body", http.StatusBadRequest)
		return
	}

	if !s.verifySignature(body, r.Header.Get("X-Alchemy-Signature")) {
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	var payload alchemyActivityPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "bad payload", http.StatusBadRequest)
		return
	}

	// Persist raw event for audit.
	s.db.Exec(r.Context(), `
		INSERT INTO alchemy_events (webhook_type, payload_json) VALUES ($1, $2)`,
		payload.Type, body,
	)

	for _, activity := range payload.Event.Activity {
		s.processActivity(r.Context(), activity, payload.Event.Network)
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Service) processActivity(ctx context.Context, a alchemyActivity, network string) {
	if a.ToAddress != "" {
		// Invalidate balance cache for recipient — next read re-fetches from RPC.
		cacheKey := fmt.Sprintf("balance:%s:%s:%s", network, a.ToAddress, a.Asset)
		s.rdb.Del(ctx, cacheKey)

		// Check if the recipient is one of our managed wallets.
		var walletID string
		s.db.QueryRow(ctx,
			`SELECT id FROM wallets WHERE LOWER(address) = LOWER($1) LIMIT 1`,
			a.ToAddress,
		).Scan(&walletID)

		if walletID != "" {
			// Inbound transfer — notify connected clients via SSE.
			s.sseBus.Publish(SSEEvent{
				Type:        "tx_received",
				TxHash:      a.Hash,
				Asset:       a.Asset,
				RawValue:    a.RawContract.RawValue,
				ToAddress:   a.ToAddress,
				FromAddress: a.FromAddress,
			})
		}
	}

	// Mark outbound tx as confirmed if we know about it.
	if a.Hash != "" {
		blockNum := parseHexInt(a.BlockNum)
		_, err := s.db.Exec(ctx, `
			UPDATE transactions
			SET status='confirmed', block_number=$2, confirmed_at=NOW()
			WHERE tx_hash=$1 AND status IN ('broadcast','signed')`,
			a.Hash, blockNum,
		)
		if err != nil {
			log.Error().Err(err).Str("hash", a.Hash).Msg("confirm tx failed")
			return
		}
		s.sseBus.Publish(SSEEvent{Type: "tx_confirmed", TxHash: a.Hash, BlockNumber: blockNum})
	}
}

func (s *Service) verifySignature(body []byte, sigHeader string) bool {
	if s.webhookSecret == "" {
		return true // skip verification in dev
	}
	mac := hmac.New(sha256.New, []byte(s.webhookSecret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(sigHeader))
}

// GetBalance returns the raw ERC-20 balance (6 decimals for USDC/USDT).
// Redis-first; on cache miss calls balanceOf via JSON-RPC and caches for 60s.
func (s *Service) GetBalance(ctx context.Context, network, address, asset string) (string, error) {
	key := fmt.Sprintf("balance:%s:%s:%s", network, address, asset)

	// 1. Redis cache hit.
	if cached, err := s.rdb.Get(ctx, key).Result(); err == nil {
		return cached, nil
	}

	// 2. Determine RPC URL and token contract address.
	rpcURL, tokenAddr, err := s.rpcAndToken(network, asset)
	if err != nil || rpcURL == "" {
		return "0", nil // Alchemy not configured — return zero, don't error
	}

	// 3. Call balanceOf(address) via eth_call.
	raw, err := s.ethCallBalanceOf(ctx, rpcURL, tokenAddr, common.HexToAddress(address))
	if err != nil {
		log.Warn().Err(err).Str("network", network).Str("asset", asset).Msg("eth_call balanceOf failed")
		return "0", nil
	}

	// 4. Cache for 60 seconds.
	s.rdb.Set(ctx, key, raw, 60*time.Second)
	return raw, nil
}

func (s *Service) ethCallBalanceOf(ctx context.Context, rpcURL string, tokenAddr, holder common.Address) (string, error) {
	client, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		return "", fmt.Errorf("dial rpc: %w", err)
	}
	defer client.Close()

	calldata, err := balanceOfABI.Pack("balanceOf", holder)
	if err != nil {
		return "", fmt.Errorf("pack calldata: %w", err)
	}

	result, err := client.CallContract(ctx, ethereum.CallMsg{
		To:   &tokenAddr,
		Data: calldata,
	}, nil) // nil = latest block
	if err != nil {
		return "", fmt.Errorf("eth_call: %w", err)
	}

	if len(result) == 0 {
		return "0", nil
	}

	balance := new(big.Int).SetBytes(result)
	return balance.String(), nil
}

func (s *Service) rpcAndToken(network, asset string) (rpcURL string, tokenAddr common.Address, err error) {
	type entry struct{ rpc, addr string }
	table := map[string]map[string]entry{
		"ethereum": {
			"USDC": {s.rpc.eth, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"},
			"USDT": {s.rpc.eth, "0xdAC17F958D2ee523a2206206994597C13D831ec7"},
		},
		"polygon": {
			"USDC": {s.rpc.polygon, "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"},
			"USDT": {s.rpc.polygon, "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"},
		},
		"arbitrum": {
			"USDC": {s.rpc.arbitrum, "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"},
			"USDT": {s.rpc.arbitrum, "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"},
		},
		"base": {
			"USDC": {s.rpc.base, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"},
		},
		"optimism": {
			"USDC": {s.rpc.optimism, "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"},
			"USDT": {s.rpc.optimism, "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58"},
		},
	}
	chain, ok := table[strings.ToLower(network)]
	if !ok {
		return "", common.Address{}, fmt.Errorf("unknown network: %s", network)
	}
	tok, ok := chain[strings.ToUpper(asset)]
	if !ok {
		return "", common.Address{}, fmt.Errorf("unknown asset: %s", asset)
	}
	return tok.rpc, common.HexToAddress(tok.addr), nil
}

func parseHexInt(hex string) int64 {
	if len(hex) < 2 {
		return 0
	}
	var n int64
	fmt.Sscanf(hex[2:], "%x", &n)
	return n
}
