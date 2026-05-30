package transaction

import (
	"context"
	"fmt"
	"math/big"
	"strconv"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/redis/go-redis/v9"
	"strings"
)

// erc20TransferABI is the ABI fragment for ERC-20 transfer(address,uint256).
var erc20TransferABI abi.ABI

func init() {
	parsed, err := abi.JSON(strings.NewReader(`[{
		"name":"transfer","type":"function","stateMutability":"nonpayable",
		"inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],
		"outputs":[{"name":"","type":"bool"}]
	}]`))
	if err != nil {
		panic("transaction: parse ERC-20 ABI: " + err.Error())
	}
	erc20TransferABI = parsed
}

type BuilderConfig struct {
	AlchemyEthURL      string
	AlchemyPolygonURL  string
	AlchemyArbitrumURL string
	AlchemyBaseURL     string
	AlchemyOptimismURL string
}

type Builder struct {
	cfg BuilderConfig
	rdb *redis.Client
}

func NewBuilder(cfg BuilderConfig, rdb *redis.Client) *Builder {
	return &Builder{cfg: cfg, rdb: rdb}
}

// BuildResult holds everything needed to call mpcium and later assemble the signed tx.
type BuildResult struct {
	SigningHash    [32]byte // the 32-byte digest passed to mpcium as Tx field
	UnsignedTxRLP []byte   // stored in DB; used by assembler after signing
	Nonce         uint64
	ChainID       *big.Int
}

// BuildERC20Transfer constructs an EIP-1559 ERC-20 transfer transaction and returns
// the signing hash (what goes into SignTxMessage.Tx) and the unsigned RLP bytes.
func (b *Builder) BuildERC20Transfer(
	ctx context.Context,
	chain, token string,
	fromAddress common.Address,
	toAddress common.Address,
	amount *big.Int,
) (*BuildResult, error) {
	client, err := b.clientForChain(chain)
	if err != nil {
		return nil, err
	}
	defer client.Close()

	chainID, err := ChainID(chain)
	if err != nil {
		return nil, err
	}

	tokenAddr, err := TokenAddress(chain, token)
	if err != nil {
		return nil, err
	}

	// Nonce — fetch from Redis (incremented atomically) or fallback to RPC.
	nonce, err := b.nextNonce(ctx, chain, fromAddress, client)
	if err != nil {
		return nil, fmt.Errorf("builder: nonce: %w", err)
	}

	// Gas estimation.
	gasTip, err := client.SuggestGasTipCap(ctx)
	if err != nil {
		gasTip = big.NewInt(1e9) // 1 gwei fallback
	}
	gasFeeCap := new(big.Int).Add(gasTip, big.NewInt(20e9)) // tip + 20 gwei base fee buffer

	// ABI-encode calldata.
	calldata, err := erc20TransferABI.Pack("transfer", toAddress, amount)
	if err != nil {
		return nil, fmt.Errorf("builder: ABI pack: %w", err)
	}

	// Estimate gas limit with 20% buffer.
	gasLimit := uint64(65000) // conservative fixed limit for ERC-20 transfers

	inner := &types.DynamicFeeTx{
		ChainID:   chainID,
		Nonce:     nonce,
		GasTipCap: gasTip,
		GasFeeCap: gasFeeCap,
		Gas:       gasLimit,
		To:        &tokenAddr,
		Value:     big.NewInt(0),
		Data:      calldata,
	}

	tx := types.NewTx(inner)
	signer := types.NewLondonSigner(chainID)
	signingHash := signer.Hash(tx)

	// RLP-encode the unsigned tx for storage.
	unsignedRLP, err := tx.MarshalBinary()
	if err != nil {
		return nil, fmt.Errorf("builder: marshal unsigned tx: %w", err)
	}

	return &BuildResult{
		SigningHash:    signingHash,
		UnsignedTxRLP: unsignedRLP,
		Nonce:         nonce,
		ChainID:       chainID,
	}, nil
}

// ReleaseNonce decrements the Redis nonce counter when a tx fails (prevents gaps).
func (b *Builder) ReleaseNonce(ctx context.Context, chain string, addr common.Address) {
	key := fmt.Sprintf("nonce:%s:%s", chain, strings.ToLower(addr.Hex()))
	b.rdb.Decr(ctx, key)
}

func (b *Builder) nextNonce(ctx context.Context, chain string, addr common.Address, client *ethclient.Client) (uint64, error) {
	key := fmt.Sprintf("nonce:%s:%s", chain, strings.ToLower(addr.Hex()))

	// If Redis has no entry, seed from RPC.
	exists, _ := b.rdb.Exists(ctx, key).Result()
	if exists == 0 {
		rpcNonce, err := client.PendingNonceAt(ctx, addr)
		if err != nil {
			return 0, fmt.Errorf("rpc nonce: %w", err)
		}
		b.rdb.SetNX(ctx, key, rpcNonce, 24*time.Hour)
	}

	n, err := b.rdb.Incr(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("redis incr nonce: %w", err)
	}
	// Incr returns the value after increment; we seeded with the *next* nonce,
	// so subtract 1 to get the nonce for this tx.
	return strconv.ParseUint(strconv.FormatInt(n-1, 10), 10, 64)
}

func (b *Builder) clientForChain(chain string) (*ethclient.Client, error) {
	var url string
	switch strings.ToLower(chain) {
	case "ethereum":
		url = b.cfg.AlchemyEthURL
	case "polygon":
		url = b.cfg.AlchemyPolygonURL
	case "arbitrum":
		url = b.cfg.AlchemyArbitrumURL
	case "base":
		url = b.cfg.AlchemyBaseURL
	case "optimism":
		url = b.cfg.AlchemyOptimismURL
	default:
		return nil, fmt.Errorf("builder: unknown chain: %s", chain)
	}
	c, err := ethclient.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("builder: dial %s: %w", chain, err)
	}
	return c, nil
}
