# wallet-frontend

Reference Next.js app built to develop and validate the wallet UI components. **Not deployed as a standalone product.**

The components in this directory are being migrated into Granville Crypto as the Wallets feature. The app here exists so components can be built and tested against a real mpcium backend before that migration happens.

## What gets migrated to Granville Crypto

| Component | Destination in Granville Crypto |
|---|---|
| `WalletCarousel`, `WalletCard`, `BalanceDisplay`, `CopyAddress`, `ClusterStatus` | Wallets landing page |
| `KeygenCeremony` | Wallet creation flow (after org-admin approval) |
| `ReceiveModal`, `PriceChart`, `AnimatedNumber` | Wallet detail page |
| `SigningTheater` | Transaction confirmation step |
| `ActivityFeed`, `TxTimeline`, `TxStatusBadge` | Transaction detail |
| `SSEProvider` | Shared provider in Granville Crypto app shell |

## Roadmap

Component-level priorities (P0 MPC security story, P1 UX completeness, P2 product depth) are in [ROADMAP.md](./ROADMAP.md).

The six-phase integration plan covering how and when these components land in Granville Crypto is in [INTEGRATION.md](../INTEGRATION.md) at the repo root.
