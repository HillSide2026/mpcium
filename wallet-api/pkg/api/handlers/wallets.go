package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/hillside2026/wallet-api/pkg/api/middleware"
	"github.com/hillside2026/wallet-api/pkg/indexer"
	"github.com/hillside2026/wallet-api/pkg/wallet"
)

type WalletHandler struct {
	svc     *wallet.Service
	indexer *indexer.Service
}

func NewWalletHandler(svc *wallet.Service, indexer *indexer.Service) *WalletHandler {
	return &WalletHandler{svc: svc, indexer: indexer}
}

func (h *WalletHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())

	var req struct {
		Chain string `json:"chain"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Chain == "" {
		writeError(w, http.StatusBadRequest, "chain required (ethereum|polygon)")
		return
	}

	wallet, err := h.svc.CreateWallet(r.Context(), userID, req.Chain)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, wallet)
}

func (h *WalletHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	wallets, err := h.svc.ListWallets(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, wallets)
}

func (h *WalletHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	walletID := chi.URLParam(r, "id")

	wlt, err := h.svc.GetWallet(r.Context(), walletID, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "wallet not found")
		return
	}

	// Attach balance from indexer cache.
	balUSDC, _ := h.indexer.GetBalance(r.Context(), wlt.Chain, wlt.Address, "USDC")
	balUSDT, _ := h.indexer.GetBalance(r.Context(), wlt.Chain, wlt.Address, "USDT")

	writeJSON(w, http.StatusOK, map[string]any{
		"wallet":       wlt,
		"balances": map[string]string{
			"USDC": balUSDC,
			"USDT": balUSDT,
		},
	})
}
