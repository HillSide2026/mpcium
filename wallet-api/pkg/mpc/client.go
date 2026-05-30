package mpc

import (
	"context"
	"fmt"
	"sync"

	"github.com/fystack/mpcium/pkg/client"
	"github.com/fystack/mpcium/pkg/event"
	"github.com/fystack/mpcium/pkg/types"
	"github.com/nats-io/nats.go"
	"github.com/rs/zerolog/log"
)

type Config struct {
	NatsURL          string
	InitiatorKeyPath string
	ClientID         string
}

// ClusterStatus is returned by Health().
type ClusterStatus struct {
	Connected bool   `json:"connected"`
	NatsURL   string `json:"nats_url"`
}

// Client wraps the mpcium MPCClient and routes results to per-operation channels.
type Client struct {
	inner client.MPCClient
	nc    *nats.Conn
	cfg   Config

	mu          sync.Mutex
	keygenWait  map[string]chan event.KeygenResultEvent  // walletID → channel
	signingWait map[string]chan event.SigningResultEvent // txID → channel
}

// Health reports NATS connectivity.
func (c *Client) Health() ClusterStatus {
	return ClusterStatus{
		Connected: c.nc.IsConnected(),
		NatsURL:   c.cfg.NatsURL,
	}
}

func NewClient(ctx context.Context, cfg Config) (*Client, error) {
	nc, err := nats.Connect(cfg.NatsURL)
	if err != nil {
		return nil, fmt.Errorf("mpc: nats connect: %w", err)
	}

	signer, err := client.NewLocalSigner(types.EventInitiatorKeyTypeEd25519, client.LocalSignerOptions{
		KeyPath: cfg.InitiatorKeyPath,
	})
	if err != nil {
		return nil, fmt.Errorf("mpc: load initiator key: %w", err)
	}

	inner := client.NewMPCClient(client.Options{
		NatsConn: nc,
		Signer:   signer,
		ClientID: cfg.ClientID,
	})

	c := &Client{
		inner:       inner,
		nc:          nc,
		cfg:         cfg,
		keygenWait:  make(map[string]chan event.KeygenResultEvent),
		signingWait: make(map[string]chan event.SigningResultEvent),
	}

	if err := inner.OnWalletCreationResult(c.handleKeygenResult); err != nil {
		return nil, fmt.Errorf("mpc: subscribe keygen result: %w", err)
	}
	if err := inner.OnSignResult(c.handleSignResult); err != nil {
		return nil, fmt.Errorf("mpc: subscribe sign result: %w", err)
	}

	// Stop NATS on context cancellation.
	go func() {
		<-ctx.Done()
		nc.Drain()
	}()

	log.Info().Str("clientID", cfg.ClientID).Msg("mpc client ready")
	return c, nil
}

// CreateWallet triggers keygen and returns a channel that will receive exactly one result.
func (c *Client) CreateWallet(walletID string) (<-chan event.KeygenResultEvent, error) {
	ch := make(chan event.KeygenResultEvent, 1)
	c.mu.Lock()
	c.keygenWait[walletID] = ch
	c.mu.Unlock()

	if err := c.inner.CreateWallet(walletID); err != nil {
		c.mu.Lock()
		delete(c.keygenWait, walletID)
		c.mu.Unlock()
		return nil, fmt.Errorf("mpc: CreateWallet publish: %w", err)
	}
	return ch, nil
}

// SignTransaction submits a signing request and returns a channel for the result.
func (c *Client) SignTransaction(msg *types.SignTxMessage) (<-chan event.SigningResultEvent, error) {
	ch := make(chan event.SigningResultEvent, 1)
	c.mu.Lock()
	c.signingWait[msg.TxID] = ch
	c.mu.Unlock()

	if err := c.inner.SignTransaction(msg); err != nil {
		c.mu.Lock()
		delete(c.signingWait, msg.TxID)
		c.mu.Unlock()
		return nil, fmt.Errorf("mpc: SignTransaction publish: %w", err)
	}
	return ch, nil
}

func (c *Client) handleKeygenResult(ev event.KeygenResultEvent) {
	c.mu.Lock()
	ch, ok := c.keygenWait[ev.WalletID]
	if ok {
		delete(c.keygenWait, ev.WalletID)
	}
	c.mu.Unlock()

	if !ok {
		log.Warn().Str("walletID", ev.WalletID).Msg("keygen result with no waiter")
		return
	}
	ch <- ev
}

func (c *Client) handleSignResult(ev event.SigningResultEvent) {
	c.mu.Lock()
	ch, ok := c.signingWait[ev.TxID]
	if ok {
		delete(c.signingWait, ev.TxID)
	}
	c.mu.Unlock()

	if !ok {
		log.Warn().Str("txID", ev.TxID).Msg("sign result with no waiter")
		return
	}
	ch <- ev
}
