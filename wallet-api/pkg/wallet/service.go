package wallet

import (
	"context"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/fystack/mpcium/pkg/event"
	"github.com/google/uuid"
	"github.com/hillside2026/wallet-api/pkg/mpc"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

const keygenTimeout = 5 * time.Minute

// Wallet represents a managed MPC wallet.
type Wallet struct {
	ID            string `json:"id"`
	UserID        string `json:"user_id"`
	MPCWalletID   string `json:"mpc_wallet_id"`
	Chain         string `json:"chain"`
	Address       string `json:"address"`
	DerivationPath string `json:"derivation_path"`
	CreatedAt     string `json:"created_at"`
}

type Service struct {
	db        *pgxpool.Pool
	mpcClient *mpc.Client
	rdb       *redis.Client
}

func NewService(db *pgxpool.Pool, mpcClient *mpc.Client, rdb *redis.Client) *Service {
	return &Service{db: db, mpcClient: mpcClient, rdb: rdb}
}

// CreateWallet triggers keygen on the mpcium cluster for a given chain,
// waits for the result, derives the EVM address, and persists the wallet.
func (s *Service) CreateWallet(ctx context.Context, userID, chain string) (*Wallet, error) {
	mpcWalletID := uuid.New().String()

	resultCh, err := s.mpcClient.CreateWallet(mpcWalletID)
	if err != nil {
		return nil, fmt.Errorf("wallet: trigger keygen: %w", err)
	}

	select {
	case result := <-resultCh:
		if result.ResultType != event.ResultTypeSuccess {
			return nil, fmt.Errorf("wallet: keygen failed: %s (%s)", result.ErrorReason, result.ErrorCode)
		}
		return s.persistWallet(ctx, userID, mpcWalletID, chain, result)

	case <-time.After(keygenTimeout):
		return nil, fmt.Errorf("wallet: keygen timed out after %s", keygenTimeout)

	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (s *Service) persistWallet(
	ctx context.Context,
	userID, mpcWalletID, chain string,
	result event.KeygenResultEvent,
) (*Wallet, error) {
	address, err := derivedEVMAddress(result.ECDSAPubKey)
	if err != nil {
		return nil, fmt.Errorf("wallet: address derivation: %w", err)
	}

	log.Info().
		Str("walletID", mpcWalletID).
		Str("address", address).
		Str("chain", chain).
		Msg("wallet created")

	var walletID string
	err = s.db.QueryRow(ctx, `
		INSERT INTO wallets (user_id, mpc_wallet_id, chain, ecdsa_pub_key, address, derivation_path)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id`,
		userID, mpcWalletID, chain, result.ECDSAPubKey, address, "",
	).Scan(&walletID)
	if err != nil {
		return nil, fmt.Errorf("wallet: db insert: %w", err)
	}

	return &Wallet{
		ID:          walletID,
		UserID:      userID,
		MPCWalletID: mpcWalletID,
		Chain:       chain,
		Address:     address,
	}, nil
}

// GetWallet returns a wallet by ID, enforcing user ownership.
func (s *Service) GetWallet(ctx context.Context, walletID, userID string) (*Wallet, error) {
	w := &Wallet{}
	err := s.db.QueryRow(ctx, `
		SELECT id, user_id, mpc_wallet_id, chain, address, derivation_path, created_at::text
		FROM wallets WHERE id = $1 AND user_id = $2`,
		walletID, userID,
	).Scan(&w.ID, &w.UserID, &w.MPCWalletID, &w.Chain, &w.Address, &w.DerivationPath, &w.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("wallet: get: %w", err)
	}
	return w, nil
}

// ListWallets returns all wallets for a user.
func (s *Service) ListWallets(ctx context.Context, userID string) ([]*Wallet, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, user_id, mpc_wallet_id, chain, address, derivation_path, created_at::text
		FROM wallets WHERE user_id = $1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("wallet: list: %w", err)
	}
	defer rows.Close()

	var wallets []*Wallet
	for rows.Next() {
		w := &Wallet{}
		if err := rows.Scan(&w.ID, &w.UserID, &w.MPCWalletID, &w.Chain, &w.Address, &w.DerivationPath, &w.CreatedAt); err != nil {
			return nil, err
		}
		wallets = append(wallets, w)
	}
	return wallets, rows.Err()
}

// derivedEVMAddress derives a checksummed 0x EVM address from the secp256k1
// public key returned by mpcium.
//
// mpcium returns ECDSAPubKey as 64 raw bytes (X‖Y, no 0x04 prefix).
// EVM address = keccak256(X‖Y)[12:] (last 20 bytes of the 32-byte hash).
func derivedEVMAddress(pubKeyBytes []byte) (string, error) {
	var uncompressed []byte

	switch len(pubKeyBytes) {
	case 64:
		// Raw X‖Y — prepend 0x04 so go-ethereum can parse it.
		uncompressed = append([]byte{0x04}, pubKeyBytes...)
	case 65:
		// Already 0x04 || X || Y.
		uncompressed = pubKeyBytes
	case 33:
		// Compressed — decompress first.
		pub, err := crypto.DecompressPubkey(pubKeyBytes)
		if err != nil {
			return "", fmt.Errorf("decompress pubkey: %w", err)
		}
		addr := crypto.PubkeyToAddress(*pub)
		return strings.ToLower("0x" + hex.EncodeToString(addr.Bytes())), nil
	default:
		return "", fmt.Errorf("unexpected pubkey length %d (expected 33, 64, or 65)", len(pubKeyBytes))
	}

	pub, err := crypto.UnmarshalPubkey(uncompressed)
	if err != nil {
		return "", fmt.Errorf("unmarshal pubkey: %w", err)
	}
	addr := crypto.PubkeyToAddress(*pub)
	return strings.ToLower("0x" + hex.EncodeToString(addr.Bytes())), nil
}
