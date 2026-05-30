package handlers

import (
	"encoding/json"
	"math/big"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/hillside2026/wallet-api/pkg/api/middleware"
	"github.com/hillside2026/wallet-api/pkg/transaction"
	"github.com/hillside2026/wallet-api/pkg/wallet"
)

type TransactionHandler struct {
	txSvc     *transaction.Service
	walletSvc *wallet.Service
	// Policy evaluation is Granville's responsibility.
	// mpcium signs whatever Granville has already approved.
}

func NewTransactionHandler(txSvc *transaction.Service, walletSvc *wallet.Service) *TransactionHandler {
	return &TransactionHandler{txSvc: txSvc, walletSvc: walletSvc}
}

func (h *TransactionHandler) Send(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())

	var req struct {
		WalletID  string `json:"wallet_id"`
		Token     string `json:"token"`
		ToAddress string `json:"to_address"`
		Amount    string `json:"amount"` // raw token units
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.WalletID == "" || req.Token == "" || req.ToAddress == "" || req.Amount == "" {
		writeError(w, http.StatusBadRequest, "wallet_id, token, to_address, amount required")
		return
	}

	amount := new(big.Int)
	if _, ok := amount.SetString(req.Amount, 10); !ok {
		writeError(w, http.StatusBadRequest, "amount must be a decimal integer (raw token units)")
		return
	}

	// Ownership check — passes for service token calls (userID will be empty).
	wlt, err := h.walletSvc.GetWallet(r.Context(), req.WalletID, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "wallet not found")
		return
	}

	// No policy check here — policy is Granville's responsibility.
	// mpcium signs whatever arrives through an authenticated call.
	tx, err := h.txSvc.Send(r.Context(), &transaction.SendRequest{
		WalletID:  req.WalletID,
		Chain:     wlt.Chain,
		Token:     req.Token,
		ToAddress: req.ToAddress,
		Amount:    amount,
	}, wlt.MPCWalletID, wlt.Address)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusAccepted, tx)
}

func (h *TransactionHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	txDBID  := chi.URLParam(r, "id")
	walletID := r.URL.Query().Get("wallet_id")

	if walletID != "" {
		if _, err := h.walletSvc.GetWallet(r.Context(), walletID, userID); err != nil {
			writeError(w, http.StatusNotFound, "wallet not found")
			return
		}
	}

	tx, err := h.txSvc.GetTx(r.Context(), txDBID, walletID)
	if err != nil {
		writeError(w, http.StatusNotFound, "transaction not found")
		return
	}
	writeJSON(w, http.StatusOK, tx)
}

func (h *TransactionHandler) ListByWallet(w http.ResponseWriter, r *http.Request) {
	userID   := middleware.UserIDFromContext(r.Context())
	walletID := chi.URLParam(r, "id")

	if _, err := h.walletSvc.GetWallet(r.Context(), walletID, userID); err != nil {
		writeError(w, http.StatusNotFound, "wallet not found")
		return
	}

	txs, err := h.txSvc.ListByWallet(r.Context(), walletID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if txs == nil {
		txs = []*transaction.Tx{}
	}
	writeJSON(w, http.StatusOK, txs)
}
