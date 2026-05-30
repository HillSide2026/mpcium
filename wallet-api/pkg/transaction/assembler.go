package transaction

import (
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/core/types"
)

// AssembleSignedTx takes the stored unsigned tx RLP and the mpcium signature
// components (R, S, SignatureRecovery) and returns the broadcast-ready signed tx RLP.
//
// mpcium returns:
//   - R []byte   — big-endian 32-byte r component
//   - S []byte   — big-endian 32-byte s component
//   - SignatureRecovery []byte — 1-byte recovery id (0 or 1)
//
// go-ethereum's WithSignature expects a 65-byte sig: [R(32) || S(32) || V(1)].
// For EIP-1559 txs, V is the raw recovery id (0 or 1), not the legacy 27/28.
func AssembleSignedTx(unsignedTxRLP, r, s, recovery []byte, chainID *big.Int) ([]byte, error) {
	tx := new(types.Transaction)
	if err := tx.UnmarshalBinary(unsignedTxRLP); err != nil {
		return nil, fmt.Errorf("assembler: unmarshal unsigned tx: %w", err)
	}

	if len(r) == 0 || len(s) == 0 || len(recovery) == 0 {
		return nil, fmt.Errorf("assembler: missing signature components")
	}

	// Pad r and s to 32 bytes in case mpcium trims leading zeros.
	rPadded := padLeft(r, 32)
	sPadded := padLeft(s, 32)

	// v is the recovery id for EIP-1559 (0 or 1).
	v := recovery[len(recovery)-1] & 0x01

	sig65 := make([]byte, 65)
	copy(sig65[0:32], rPadded)
	copy(sig65[32:64], sPadded)
	sig65[64] = v

	signer := types.NewLondonSigner(chainID)
	signed, err := tx.WithSignature(signer, sig65)
	if err != nil {
		return nil, fmt.Errorf("assembler: WithSignature: %w", err)
	}

	signedRLP, err := signed.MarshalBinary()
	if err != nil {
		return nil, fmt.Errorf("assembler: marshal signed tx: %w", err)
	}
	return signedRLP, nil
}

func padLeft(b []byte, size int) []byte {
	if len(b) >= size {
		return b[len(b)-size:]
	}
	padded := make([]byte, size)
	copy(padded[size-len(b):], b)
	return padded
}
