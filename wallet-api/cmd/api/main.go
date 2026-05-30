package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hillside2026/wallet-api/pkg/api"
	"github.com/hillside2026/wallet-api/pkg/auth"
	"github.com/hillside2026/wallet-api/pkg/db"
	"github.com/hillside2026/wallet-api/pkg/indexer"
	"github.com/hillside2026/wallet-api/pkg/mpc"
	"github.com/hillside2026/wallet-api/pkg/policy"
	"github.com/hillside2026/wallet-api/pkg/transaction"
	"github.com/hillside2026/wallet-api/pkg/wallet"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/viper"
)

func main() {
	initConfig()
	initLogger()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Database
	pool, err := db.Connect(ctx, viper.GetString("database.url"))
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to postgres")
	}
	defer pool.Close()

	if err := db.Migrate(viper.GetString("database.url")); err != nil {
		log.Fatal().Err(err).Msg("failed to run migrations")
	}

	// Redis
	rdb := db.NewRedisClient(viper.GetString("redis.url"))
	defer rdb.Close()

	// mpcium client — starts background listeners for keygen + sign results
	mpcClient, err := mpc.NewClient(ctx, mpc.Config{
		NatsURL:          viper.GetString("nats.url"),
		InitiatorKeyPath: viper.GetString("mpc.initiator_key_path"),
		ClientID:         viper.GetString("mpc.client_id"),
	})
	if err != nil {
		log.Fatal().Err(err).Msg("failed to init mpc client")
	}

	// Services
	authSvc := auth.NewService(auth.Config{
		JWTSecret:      viper.GetString("auth.jwt_secret"),
		TokenTTL:       viper.GetDuration("auth.token_ttl"),
		RefreshTokenTTL: viper.GetDuration("auth.refresh_token_ttl"),
	}, pool)

	walletSvc := wallet.NewService(pool, mpcClient, rdb)

	txBuilder := transaction.NewBuilder(transaction.BuilderConfig{
		AlchemyEthURL:      viper.GetString("alchemy.eth_url"),
		AlchemyPolygonURL:  viper.GetString("alchemy.polygon_url"),
		AlchemyArbitrumURL: viper.GetString("alchemy.arbitrum_url"),
		AlchemyBaseURL:     viper.GetString("alchemy.base_url"),
		AlchemyOptimismURL: viper.GetString("alchemy.optimism_url"),
	}, rdb)

	broadcaster := transaction.NewBroadcaster(transaction.BroadcasterConfig{
		AlchemyEthURL:      viper.GetString("alchemy.eth_url"),
		AlchemyPolygonURL:  viper.GetString("alchemy.polygon_url"),
		AlchemyArbitrumURL: viper.GetString("alchemy.arbitrum_url"),
		AlchemyBaseURL:     viper.GetString("alchemy.base_url"),
		AlchemyOptimismURL: viper.GetString("alchemy.optimism_url"),
	})

	txSvc := transaction.NewService(pool, mpcClient, txBuilder, broadcaster, rdb)
	policySvc := policy.NewEngine(pool)
	indexerSvc := indexer.NewService(pool, rdb, indexer.Config{
		WebhookSecret:      viper.GetString("alchemy.webhook_secret"),
		AlchemyEthURL:      viper.GetString("alchemy.eth_url"),
		AlchemyPolyURL:     viper.GetString("alchemy.polygon_url"),
		AlchemyArbitrumURL: viper.GetString("alchemy.arbitrum_url"),
		AlchemyBaseURL:     viper.GetString("alchemy.base_url"),
		AlchemyOptimismURL: viper.GetString("alchemy.optimism_url"),
	})

	// HTTP server
	router := api.NewRouter(api.RouterDeps{
		Auth:      authSvc,
		Wallet:    walletSvc,
		Tx:        txSvc,
		Policy:    policySvc,
		Indexer:   indexerSvc,
		MpcClient: mpcClient,
	})

	srv := &http.Server{
		Addr:         viper.GetString("server.addr"),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Info().Str("addr", srv.Addr).Msg("wallet-api listening")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server error")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("shutting down")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()
	_ = srv.Shutdown(shutdownCtx)
}

func initConfig() {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("/etc/wallet-api")
	viper.AutomaticEnv()

	viper.SetDefault("server.addr", ":8080")
	viper.SetDefault("auth.token_ttl", 24*time.Hour)
	viper.SetDefault("auth.refresh_token_ttl", 7*24*time.Hour)
	viper.SetDefault("mpc.client_id", "wallet-api")

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			log.Fatal().Err(err).Msg("failed to read config")
		}
	}
}

func initLogger() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if viper.GetString("env") == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}
	level, err := zerolog.ParseLevel(viper.GetString("log_level"))
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)
}
