package transaction

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/common"
	ethtypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/fystack/mpcium/pkg/event"
	mpctypes "github.com/fystack/mpcium/pkg/types"
	"github.com/google/uuid"
	"github.com/hillside2026/wallet-api/pkg/mpc"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

const signingTimeout = 3 * time.Minute

// Status mirrors the tx_status Postgres enum.
type Status string

const (
	StatusDraft       Status = "draft"
	StatusPolicyCheck Status = "policy_check"
	StatusSigning     Status = "signing"
	StatusSigned      Status = "signed"
	StatusBroadcast   Status = "broadcast"
	StatusConfirmed   Status = "confirmed"
	StatusFailed      Status = "failed"
)

// Tx is a transaction record returned from the API.
type Tx struct {
	ID          string `json:"id"`
	WalletID    string `json:"wallet_id"`
	TxID        string `json:"tx_id"`
	Chain       string `json:"chain"`
	Token       string `json:"token"`
	ToAddress   string `json:"to_address"`
	AmountRaw   string `json:"amount_raw"`
	Status      string `json:"status"`
	TxHash      string `json:"tx_hash,omitempty"`
	BlockNumber int64  `json:"block_number,omitempty"`
	CreatedAt   string `json:"created_at"`
}

// SendRequest is the input for initiating a transfer.
type SendRequest struct {
	WalletID  string   `json:"wallet_id"`
	Chain     string   `json:"chain"`
	Token     string   `json:"token"`
	ToAddress string   `json:"to_address"`
	Amount    *big.Int `json:"amount"` // raw token units
}

type Service struct {
	db          *pgxpool.Pool
	mpcClient   *mpc.Client
	builder     *Builder
	broadcaster *Broadcaster
	rdb         *redis.Client
}

func NewService(db *pgxpool.Pool, mpcClient *mpc.Client, builder *Builder, broadcaster *Broadcaster, rdb *redis.Client) *Service {
	return &Service{db: db, mpcClient: mpcClient, builder: builder, broadcaster: broadcaster, rdb: rdb}
}

// Send executes the full pipeline: build → sign → assemble → broadcast.
// The caller is responsible for running policy checks before calling Send.
func (s *Service) Send(ctx context.Context, req *SendRequest, mpcWalletID, fromAddress string) (*Tx, error) {
	txID := uuid.New().String()

	// 1. Build unsigned tx and compute signing hash.
	buildResult, err := s.builder.BuildERC20Transfer(
		ctx,
		req.Chain,
		req.Token,
		common.HexToAddress(fromAddress),
		common.HexToAddress(req.ToAddress),
		req.Amount,
	)
	if err != nil {
		return nil, fmt.Errorf("send: build tx: %w", err)
	}

	// 2. Persist draft record.
	tx, err := s.insertDraft(ctx, req, txID, buildResult.UnsignedTxRLP)
	if err != nil {
		s.builder.ReleaseNonce(ctx, req.Chain, common.HexToAddress(fromAddress))
		return nil, fmt.Errorf("send: insert draft: %w", err)
	}

	if err := s.updateStatus(ctx, tx.ID, StatusSigning, ""); err != nil {
		return nil, err
	}

	// 3. Request MPC signing.
	signMsg := &mpctypes.SignTxMessage{
		KeyType:             mpctypes.KeyTypeSecp256k1,
		WalletID:            mpcWalletID,
		NetworkInternalCode: req.Chain,
		TxID:                txID,
		Tx:                  buildResult.SigningHash[:],
	}

	resultCh, err := s.mpcClient.SignTransaction(signMsg)
	if err != nil {
		s.updateStatus(ctx, tx.ID, StatusFailed, err.Error())
		s.builder.ReleaseNonce(ctx, req.Chain, common.HexToAddress(fromAddress))
		return nil, fmt.Errorf("send: submit signing: %w", err)
	}

	// 4. Wait for signature.
	var signResult event.SigningResultEvent
	select {
	case signResult = <-resultCh:
	case <-time.After(signingTimeout):
		s.updateStatus(ctx, tx.ID, StatusFailed, "signing timeout")
		s.builder.ReleaseNonce(ctx, req.Chain, common.HexToAddress(fromAddress))
		return nil, fmt.Errorf("send: signing timed out")
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	if signResult.ResultType != event.ResultTypeSuccess {
		s.updateStatus(ctx, tx.ID, StatusFailed, signResult.ErrorReason)
		s.builder.ReleaseNonce(ctx, req.Chain, common.HexToAddress(fromAddress))
		return nil, fmt.Errorf("send: signing failed: %s (%s)", signResult.ErrorReason, signResult.ErrorCode)
	}
	s.updateStatus(ctx, tx.ID, StatusSigned, "")

	// 5. Assemble signed tx.
	signedRLP, err := AssembleSignedTx(
		buildResult.UnsignedTxRLP,
		signResult.R,
		signResult.S,
		signResult.SignatureRecovery,
		buildResult.ChainID,
	)
	if err != nil {
		s.updateStatus(ctx, tx.ID, StatusFailed, err.Error())
		return nil, fmt.Errorf("send: assemble tx: %w", err)
	}
	s.saveSignedRLP(ctx, tx.ID, signedRLP)

	// 6. Broadcast.
	txHash, err := s.broadcaster.BroadcastTx(ctx, req.Chain, signedRLP)
	if err != nil {
		s.updateStatus(ctx, tx.ID, StatusFailed, err.Error())
		return nil, fmt.Errorf("send: broadcast: %w", err)
	}

	if err := s.saveTxHash(ctx, tx.ID, txHash); err != nil {
		log.Error().Err(err).Str("txID", txID).Msg("failed to save tx hash")
	}
	s.updateStatus(ctx, tx.ID, StatusBroadcast, "")

	tx.Status = string(StatusBroadcast)
	tx.TxHash = txHash
	return tx, nil
}

// GetTx returns a transaction by ID, enforcing wallet ownership.
func (s *Service) GetTx(ctx context.Context, txDBID, walletID string) (*Tx, error) {
	tx := &Tx{}
	err := s.db.QueryRow(ctx, `
		SELECT id, wallet_id, tx_id, chain, token, to_address, amount_raw::text,
		       status, COALESCE(tx_hash,''), COALESCE(block_number,0), created_at::text
		FROM transactions WHERE id = $1 AND wallet_id = $2`,
		txDBID, walletID,
	).Scan(&tx.ID, &tx.WalletID, &tx.TxID, &tx.Chain, &tx.Token, &tx.ToAddress,
		&tx.AmountRaw, &tx.Status, &tx.TxHash, &tx.BlockNumber, &tx.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("tx: get: %w", err)
	}
	return tx, nil
}

// ListByWallet returns transactions for a wallet, newest first, capped at 50.
func (s *Service) ListByWallet(ctx context.Context, walletID string) ([]*Tx, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, wallet_id, tx_id, chain, token, to_address, amount_raw::text,
		       status, COALESCE(tx_hash,''), COALESCE(block_number,0), created_at::text
		FROM transactions
		WHERE wallet_id = $1
		ORDER BY created_at DESC
		LIMIT 50`,
		walletID,
	)
	if err != nil {
		return nil, fmt.Errorf("tx: list by wallet: %w", err)
	}
	defer rows.Close()

	var txs []*Tx
	for rows.Next() {
		tx := &Tx{}
		if err := rows.Scan(
			&tx.ID, &tx.WalletID, &tx.TxID, &tx.Chain, &tx.Token, &tx.ToAddress,
			&tx.AmountRaw, &tx.Status, &tx.TxHash, &tx.BlockNumber, &tx.CreatedAt,
		); err != nil {
			return nil, err
		}
		txs = append(txs, tx)
	}
	return txs, rows.Err()
}

// CancelTx replaces a pending/broadcast transaction with a 0-value self-transfer at the same nonce
// but with a 20% higher gas price, effectively cancelling the original.
func (s *Service) CancelTx(ctx context.Context, txDBID, walletID, fromAddress, mpcWalletID, chain string) (*Tx, error) {
	// Load the original tx to extract its nonce.
	var unsignedRLP []byte
	err := s.db.QueryRow(ctx,
		`SELECT unsigned_tx_rlp FROM transactions WHERE id=$1 AND wallet_id=$2 AND status IN ('broadcast','signed')`,
		txDBID, walletID,
	).Scan(&unsignedRLP)
	if err != nil {
		return nil, fmt.Errorf("cancel: load tx: %w", err)
	}

	orig := new(ethtypes.Transaction)
	if err := orig.UnmarshalBinary(unsignedRLP); err != nil {
		return nil, fmt.Errorf("cancel: decode tx: %w", err)
	}

	chainID, err := ChainID(chain)
	if err != nil {
		return nil, err
	}

	// Build a 0-value self-transfer at the same nonce with 20% higher gas tip.
	bumpedTip := new(big.Int).Mul(orig.GasTipCap(), big.NewInt(120))
	bumpedTip.Div(bumpedTip, big.NewInt(100))
	bumpedCap := new(big.Int).Mul(orig.GasFeeCap(), big.NewInt(120))
	bumpedCap.Div(bumpedCap, big.NewInt(100))

	selfAddr := common.HexToAddress(fromAddress)
	cancelTx := ethtypes.NewTx(&ethtypes.DynamicFeeTx{
		ChainID:   chainID,
		Nonce:     orig.Nonce(),
		GasTipCap: bumpedTip,
		GasFeeCap: bumpedCap,
		Gas:       21000,
		To:        &selfAddr,
		Value:     big.NewInt(0),
		Data:      nil,
	})
	signer := ethtypes.NewLondonSigner(chainID)
	signingHash := signer.Hash(cancelTx)
	unsignedCancelRLP, _ := cancelTx.MarshalBinary()

	cancelTxID := uuid.New().String()
	newTx, err := s.insertDraft(ctx, &SendRequest{
		WalletID: walletID, Chain: chain, Token: "USDC",
		ToAddress: fromAddress, Amount: big.NewInt(0),
	}, cancelTxID, unsignedCancelRLP)
	if err != nil {
		return nil, fmt.Errorf("cancel: insert cancel tx: %w", err)
	}

	s.updateStatus(ctx, newTx.ID, StatusSigning, "")
	resultCh, err := s.mpcClient.SignTransaction(&mpctypes.SignTxMessage{
		KeyType: mpctypes.KeyTypeSecp256k1, WalletID: mpcWalletID,
		NetworkInternalCode: chain, TxID: cancelTxID, Tx: signingHash[:],
	})
	if err != nil {
		s.updateStatus(ctx, newTx.ID, StatusFailed, err.Error())
		return nil, err
	}

	select {
	case result := <-resultCh:
		if result.ResultType != "success" {
			s.updateStatus(ctx, newTx.ID, StatusFailed, result.ErrorReason)
			return nil, fmt.Errorf("cancel signing failed: %s", result.ErrorReason)
		}
		signedRLP, err := AssembleSignedTx(unsignedCancelRLP, result.R, result.S, result.SignatureRecovery, chainID)
		if err != nil {
			return nil, err
		}
		s.saveSignedRLP(ctx, newTx.ID, signedRLP)
		txHash, err := s.broadcaster.BroadcastTx(ctx, chain, signedRLP)
		if err != nil {
			s.updateStatus(ctx, newTx.ID, StatusFailed, err.Error())
			return nil, err
		}
		s.saveTxHash(ctx, newTx.ID, txHash)
		s.updateStatus(ctx, newTx.ID, StatusBroadcast, "")
		// Mark original as cancelled.
		s.db.Exec(ctx, `UPDATE transactions SET status='failed', mpc_error_code='cancelled_by_user' WHERE id=$1`, txDBID)
		newTx.Status = string(StatusBroadcast)
		newTx.TxHash = txHash
		return newTx, nil
	case <-time.After(signingTimeout):
		return nil, fmt.Errorf("cancel: signing timed out")
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// SpeedUpTx resubmits the same transaction with a 20% higher gas price.
func (s *Service) SpeedUpTx(ctx context.Context, txDBID, walletID, mpcWalletID, chain string) (*Tx, error) {
	var unsignedRLP []byte
	err := s.db.QueryRow(ctx,
		`SELECT unsigned_tx_rlp FROM transactions WHERE id=$1 AND wallet_id=$2 AND status IN ('broadcast','signed')`,
		txDBID, walletID,
	).Scan(&unsignedRLP)
	if err != nil {
		return nil, fmt.Errorf("speedup: load tx: %w", err)
	}

	orig := new(ethtypes.Transaction)
	if err := orig.UnmarshalBinary(unsignedRLP); err != nil {
		return nil, fmt.Errorf("speedup: decode tx: %w", err)
	}

	chainID, err := ChainID(chain)
	if err != nil {
		return nil, err
	}

	bumpedTip := new(big.Int).Mul(orig.GasTipCap(), big.NewInt(120))
	bumpedTip.Div(bumpedTip, big.NewInt(100))
	bumpedCap := new(big.Int).Mul(orig.GasFeeCap(), big.NewInt(120))
	bumpedCap.Div(bumpedCap, big.NewInt(100))

	speedTx := ethtypes.NewTx(&ethtypes.DynamicFeeTx{
		ChainID:   chainID,
		Nonce:     orig.Nonce(),
		GasTipCap: bumpedTip,
		GasFeeCap: bumpedCap,
		Gas:       orig.Gas(),
		To:        orig.To(),
		Value:     orig.Value(),
		Data:      orig.Data(),
	})
	signer := ethtypes.NewLondonSigner(chainID)
	signingHash := signer.Hash(speedTx)
	unsignedSpeedRLP, _ := speedTx.MarshalBinary()

	speedTxID := uuid.New().String()
	// Record nonce in original wallet/token context.
	var toAddr, token, amtStr string
	s.db.QueryRow(ctx, `SELECT to_address, token, amount_raw::text FROM transactions WHERE id=$1`, txDBID).
		Scan(&toAddr, &token, &amtStr)
	amt, _ := new(big.Int).SetString(amtStr, 10)

	newTx, err := s.insertDraft(ctx, &SendRequest{
		WalletID: walletID, Chain: chain, Token: token, ToAddress: toAddr, Amount: amt,
	}, speedTxID, unsignedSpeedRLP)
	if err != nil {
		return nil, err
	}

	s.updateStatus(ctx, newTx.ID, StatusSigning, "")
	resultCh, err := s.mpcClient.SignTransaction(&mpctypes.SignTxMessage{
		KeyType: mpctypes.KeyTypeSecp256k1, WalletID: mpcWalletID,
		NetworkInternalCode: chain, TxID: speedTxID, Tx: signingHash[:],
	})
	if err != nil {
		s.updateStatus(ctx, newTx.ID, StatusFailed, err.Error())
		return nil, err
	}

	select {
	case result := <-resultCh:
		if result.ResultType != "success" {
			s.updateStatus(ctx, newTx.ID, StatusFailed, result.ErrorReason)
			return nil, fmt.Errorf("speedup signing failed: %s", result.ErrorReason)
		}
		signedRLP, err := AssembleSignedTx(unsignedSpeedRLP, result.R, result.S, result.SignatureRecovery, chainID)
		if err != nil {
			return nil, err
		}
		s.saveSignedRLP(ctx, newTx.ID, signedRLP)
		txHash, err := s.broadcaster.BroadcastTx(ctx, chain, signedRLP)
		if err != nil {
			s.updateStatus(ctx, newTx.ID, StatusFailed, err.Error())
			return nil, err
		}
		s.saveTxHash(ctx, newTx.ID, txHash)
		s.updateStatus(ctx, newTx.ID, StatusBroadcast, "")
		newTx.Status = string(StatusBroadcast)
		newTx.TxHash = txHash
		return newTx, nil
	case <-time.After(signingTimeout):
		return nil, fmt.Errorf("speedup: signing timed out")
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// ConfirmTx marks a transaction as confirmed with block number (called by Alchemy webhook handler).
func (s *Service) ConfirmTx(ctx context.Context, txHash string, blockNumber int64) error {
	_, err := s.db.Exec(ctx, `
		UPDATE transactions SET status='confirmed', tx_hash=$1, block_number=$2, confirmed_at=NOW()
		WHERE tx_hash=$1`,
		txHash, blockNumber,
	)
	return err
}

func (s *Service) insertDraft(ctx context.Context, req *SendRequest, txID string, unsignedRLP []byte) (*Tx, error) {
	tx := &Tx{}
	err := s.db.QueryRow(ctx, `
		INSERT INTO transactions (wallet_id, tx_id, chain, token, to_address, amount_raw, status, unsigned_tx_rlp)
		VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7)
		RETURNING id, wallet_id, tx_id, chain, token, to_address, amount_raw::text, status, created_at::text`,
		req.WalletID, txID, req.Chain, req.Token, req.ToAddress, req.Amount.String(), unsignedRLP,
	).Scan(&tx.ID, &tx.WalletID, &tx.TxID, &tx.Chain, &tx.Token, &tx.ToAddress, &tx.AmountRaw, &tx.Status, &tx.CreatedAt)
	return tx, err
}

func (s *Service) updateStatus(ctx context.Context, id string, status Status, mpcErr string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE transactions SET status=$1, mpc_error_code=$2 WHERE id=$3`,
		string(status), mpcErr, id,
	)
	return err
}

func (s *Service) saveSignedRLP(ctx context.Context, id string, rlp []byte) {
	s.db.Exec(ctx, `UPDATE transactions SET signed_tx_rlp=$1 WHERE id=$2`, rlp, id)
}

func (s *Service) saveTxHash(ctx context.Context, id, hash string) error {
	_, err := s.db.Exec(ctx, `UPDATE transactions SET tx_hash=$1 WHERE id=$2`, hash, id)
	return err
}
