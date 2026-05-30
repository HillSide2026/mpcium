package indexer

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
)

// SSEEvent is the payload pushed to connected browser clients.
type SSEEvent struct {
	Type        string `json:"type"`
	TxHash      string `json:"tx_hash,omitempty"`
	BlockNumber int64  `json:"block_number,omitempty"`
	// Inbound transfer fields
	Asset       string `json:"asset,omitempty"`
	RawValue    string `json:"raw_value,omitempty"`
	ToAddress   string `json:"to_address,omitempty"`
	FromAddress string `json:"from_address,omitempty"`
}

// SSEBus is a simple fan-out broadcaster for server-sent events.
type SSEBus struct {
	mu      sync.Mutex
	clients map[chan SSEEvent]struct{}
}

func NewSSEBus() *SSEBus {
	return &SSEBus{clients: make(map[chan SSEEvent]struct{})}
}

func (b *SSEBus) Publish(ev SSEEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for ch := range b.clients {
		select {
		case ch <- ev:
		default: // drop if client is slow
		}
	}
}

func (b *SSEBus) subscribe() chan SSEEvent {
	ch := make(chan SSEEvent, 16)
	b.mu.Lock()
	b.clients[ch] = struct{}{}
	b.mu.Unlock()
	return ch
}

func (b *SSEBus) unsubscribe(ch chan SSEEvent) {
	b.mu.Lock()
	delete(b.clients, ch)
	b.mu.Unlock()
}

// ServeSSE is the HTTP handler for GET /api/v1/events.
// Clients connect and receive newline-delimited SSE events until disconnected.
func (b *SSEBus) ServeSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ch := b.subscribe()
	defer b.unsubscribe(ch)

	for {
		select {
		case ev := <-ch:
			data, _ := json.Marshal(ev)
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Type, data)
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}
