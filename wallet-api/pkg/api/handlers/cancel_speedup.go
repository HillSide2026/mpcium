package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/hillside2026/wallet-api/pkg/api/middleware"
)

// Cancel replaces a broadcast/signed tx with a 0-value self-transfer at the same nonce + higher gas.
func (h *TransactionHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	txID := chi.URLParam(r, "id")

	// Resolve wallet and verify ownership.
	walletID := r.URL.Query().Get("wallet_id")
	wlt, err := h.walletSvc.GetWallet(r.Context(), walletID, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "wallet not found")
		return
	}

	newTx, err := h.txSvc.CancelTx(r.Context(), txID, walletID, wlt.Address, wlt.MPCWalletID, wlt.Chain)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusAccepted, newTx)
}

// SpeedUp resubmits the same tx data with 20% higher gas tip.
func (h *TransactionHandler) SpeedUp(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	txID := chi.URLParam(r, "id")

	walletID := r.URL.Query().Get("wallet_id")
	wlt, err := h.walletSvc.GetWallet(r.Context(), walletID, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "wallet not found")
		return
	}

	newTx, err := h.txSvc.SpeedUpTx(r.Context(), txID, walletID, wlt.MPCWalletID, wlt.Chain)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusAccepted, newTx)
}
