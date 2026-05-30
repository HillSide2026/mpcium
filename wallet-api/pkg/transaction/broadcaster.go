package transaction

import (
	"context"
	"fmt"
	"strings"

	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

type BroadcasterConfig struct {
	AlchemyEthURL      string
	AlchemyPolygonURL  string
	AlchemyArbitrumURL string
	AlchemyBaseURL     string
	AlchemyOptimismURL string
}

type Broadcaster struct {
	cfg BroadcasterConfig
}

func NewBroadcaster(cfg BroadcasterConfig) *Broadcaster {
	return &Broadcaster{cfg: cfg}
}

// BroadcastTx submits a signed tx RLP to the chain and returns the tx hash.
func (b *Broadcaster) BroadcastTx(ctx context.Context, chain string, signedTxRLP []byte) (string, error) {
	url, err := b.urlForChain(chain)
	if err != nil {
		return "", err
	}

	client, err := ethclient.DialContext(ctx, url)
	if err != nil {
		return "", fmt.Errorf("broadcaster: dial %s: %w", chain, err)
	}
	defer client.Close()

	tx := new(types.Transaction)
	if err := tx.UnmarshalBinary(signedTxRLP); err != nil {
		return "", fmt.Errorf("broadcaster: unmarshal tx: %w", err)
	}

	if err := client.SendTransaction(ctx, tx); err != nil {
		return "", fmt.Errorf("broadcaster: send tx: %w", err)
	}

	return tx.Hash().Hex(), nil
}

func (b *Broadcaster) urlForChain(chain string) (string, error) {
	switch strings.ToLower(chain) {
	case "ethereum":
		return b.cfg.AlchemyEthURL, nil
	case "polygon":
		return b.cfg.AlchemyPolygonURL, nil
	case "arbitrum":
		return b.cfg.AlchemyArbitrumURL, nil
	case "base":
		return b.cfg.AlchemyBaseURL, nil
	case "optimism":
		return b.cfg.AlchemyOptimismURL, nil
	default:
		return "", fmt.Errorf("broadcaster: unknown chain: %s", chain)
	}
}
