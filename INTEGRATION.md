# Granville Integration Plan

This document describes how mpcium integrates with Granville Crypto and Granville across six phases.

## Product context

- **mpcium** — MPC signing engine. The backend infrastructure. Not customer-facing.
- **Granville Crypto** — The Granville portal with the Wallets feature enabled. Owns wallet creation, keygen ceremony, approval flows, policy, and all crypto transaction management. mpcium powers it.
- **Granville** (fiat) — The existing fiat portal. Gets read-only access to wallets owned by mpcium, surfaced through Granville Crypto's API. Does not manage wallets directly.

Auth: both Granville and Granville Crypto use Clerk. The browser never calls mpcium directly — all calls flow through Granville Crypto's API. mpcium authenticates Granville Crypto's backend with a shared service token (`X-Granville-Service-Token`).

---

## Phase 1 — Architecture cleanup

**1a. Scope wallet-api to a signing service**
Remove: custom JWT auth, policy engine, standalone audit log, proposal state machine.
Keep: wallet creation (keygen), signing, wallet reads, cluster health, SSE, cancel, speed-up.

**1b. Shared auth**
Both portals use Clerk. wallet-api accepts only the Granville service token — no user-facing auth.

**1c. Integration contract**
Defined in [`wallet-api/openapi.yaml`](./wallet-api/openapi.yaml). The service surface is the `/service/*` route group.

**1d. Remove Safe/Zodiac/Pimlico scaffold from Granville**
Wrong signing mechanism. Keep DB schema for proposals, policies, audit. Remove Safe-specific code from `libs/safe/` and Safe-specific parts of `apps/api/src/treasury/`.

---

## Phase 2 — Granville Crypto: Wallets feature

Components from `wallet-frontend/` are re-parented into Granville Crypto — not rebuilt.

**2a. Wallet list** — `WalletCarousel`, `WalletCard`, `BalanceDisplay`, `CopyAddress`, `ClusterStatus` become the Wallets landing page, using Granville's nav, layout, and Clerk auth.

**2b. Wallet application / initiation** — `/wallets/new` in Granville Crypto. Form captures wallet name, chain, purpose, assigned budget, spending policy. Submitted to Granville Crypto's API. Org admin reviews and approves before keygen is triggered.

**2c. MPC keygen ceremony** — Fires after initiation is approved. `KeygenCeremony` is extracted from the carousel dialog and becomes a standalone step in the wallet creation flow.

**2d. Wallet detail** — `/wallets/:id`. On-chain address, copy button, QR receive modal, USDC/USDT balance, 7D/30D/90D price chart. `ReceiveModal`, `PriceChart`, `AnimatedNumber` move here.

---

## Phase 3 — Granville: Read-only access to wallets

**3a. Granville API proxy**
```
GET  /api/crypto/wallets        →  Granville API → mpcium wallet-api
GET  /api/crypto/wallets/:id    →  wallet summary
GET  /api/crypto/cluster        →  node health
```

**3b. Wallet summary view in Granville** — Wallet name, chain, address, USDC/USDT balance. Each entry links to `crypto.granvillefinance.ca/wallets/:id` for full management. Granville does not host wallet creation, QR, or price chart.

**3c. ClusterStatus trust signal** — Read-only `ClusterStatus` component surfaces in Granville wherever crypto wallet data appears.

---

## Phase 4 — Shared: Balances (both portals)

**4a. Crypto balances aggregated** — Both portals pull wallet balances from mpcium and show them alongside fiat balances in the enterprise aggregate view. Crypto rows in Granville link to Granville Crypto; crypto rows in Granville Crypto link to the wallet detail.

**4b. Animated portfolio total** — `AnimatedNumber` applied to the aggregate balance, summing fiat + stablecoin USD values (CoinGecko prices).

---

## Phase 5 — Shared: Transactions (both portals)

**5a. Crypto transaction creation (Granville Crypto only)** — User selects a wallet, enters chain, token, recipient, amount. Granville Crypto API creates the proposal, runs policy evaluation, collects approvals — same flow as fiat.

**5b. Crypto transaction execution** — When approved, Granville Crypto API calls `POST /service/transactions` on wallet-api to sign and broadcast. `SigningTheater` fires in Granville Crypto at this step.

**5c. Crypto transaction detail (both portals)** — Renders conditionally on type:
- Fiat: existing Granville detail
- Crypto: existing detail + `TxTimeline`, Etherscan/Polygonscan link, speed-up/cancel

---

## Phase 6 — Shared: Budgets (both portals)

When a budget includes a crypto allocation, it references a wallet selected from the Phase 2 list (Granville Crypto) or Phase 3 list (Granville). Budget lines show the attached wallet and its live balance.
