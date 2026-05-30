package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/hillside2026/wallet-api/pkg/api/handlers"
	mw "github.com/hillside2026/wallet-api/pkg/api/middleware"
	"github.com/hillside2026/wallet-api/pkg/auth"
	"github.com/hillside2026/wallet-api/pkg/indexer"
	"github.com/hillside2026/wallet-api/pkg/mpc"
	"github.com/hillside2026/wallet-api/pkg/transaction"
	"github.com/hillside2026/wallet-api/pkg/wallet"
)

type RouterDeps struct {
	Auth      *auth.Service
	Wallet    *wallet.Service
	Tx        *transaction.Service
	Indexer   *indexer.Service
	MpcClient *mpc.Client
	// ServiceToken is the shared secret Granville uses for backend-to-backend calls.
	ServiceToken string
}

func NewRouter(deps RouterDeps) http.Handler {
	r := chi.NewRouter()

	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(chiMiddleware.SetHeader("Content-Type", "application/json"))

	authH    := handlers.NewAuthHandler(deps.Auth)
	walletH  := handlers.NewWalletHandler(deps.Wallet, deps.Indexer)
	txH      := handlers.NewTransactionHandler(deps.Tx, deps.Wallet)
	clusterH := handlers.NewClusterHandler(deps.MpcClient)

	// Health (unauthenticated)
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})
	r.Get("/api/v1/health/cluster", clusterH.Status)

	// Alchemy webhook (HMAC-verified inside handler)
	r.Post("/api/v1/webhooks/alchemy", deps.Indexer.HandleAlchemyWebhook)

	// Auth routes (user-facing — retained for mpcium frontend during transition)
	r.Route("/api/v1/auth", func(r chi.Router) {
		r.Post("/register", authH.Register)
		r.Post("/login", authH.Login)
	})

	// ── User-authenticated routes (mpcium frontend) ──────────────────────────
	r.Group(func(r chi.Router) {
		r.Use(mw.Authenticate(deps.Auth))

		r.Get("/api/v1/events", deps.Indexer.SSEBus().ServeSSE)

		r.Route("/api/v1/wallets", func(r chi.Router) {
			r.Post("/", walletH.Create)
			r.Get("/", walletH.List)
			r.Get("/{id}", walletH.Get)
			r.Get("/{id}/transactions", txH.ListByWallet)
		})

		r.Route("/api/v1/transactions", func(r chi.Router) {
			r.Post("/", txH.Send)
			r.Get("/{id}", txH.Get)
			r.Post("/{id}/cancel",   txH.Cancel)
			r.Post("/{id}/speed-up", txH.SpeedUp)
		})
	})

	// ── Service routes (Granville backend → mpcium, service token auth) ──────
	r.Group(func(r chi.Router) {
		r.Use(mw.ServiceToken(deps.ServiceToken))

		r.Post("/service/wallets",                    walletH.Create)
		r.Get("/service/wallets",                     walletH.ListAll)
		r.Get("/service/wallets/{id}",                walletH.Get)
		r.Post("/service/transactions",               txH.Send)
		r.Get("/service/transactions/{id}",           txH.Get)
		r.Get("/service/wallets/{id}/transactions",   txH.ListByWallet)
		r.Post("/service/transactions/{id}/cancel",   txH.Cancel)
		r.Post("/service/transactions/{id}/speed-up", txH.SpeedUp)
		r.Get("/service/health/cluster",              clusterH.Status)
		r.Get("/service/events",                      deps.Indexer.SSEBus().ServeSSE)
	})

	return r
}
