# wallet-api

HTTP service that wraps the mpcium MPC cluster and exposes it to Granville Crypto via a backend-to-backend REST API.

## Product context

| Product | Role |
|---|---|
| **mpcium** (this repo) | MPC signing engine. Holds key shares, runs keygen ceremonies, signs transactions. |
| **Granville Crypto** | Customer-facing crypto portal. Owns wallet creation UX, approval flows, policy, and the Granville Crypto API that proxies all calls to wallet-api. |
| **Granville** (fiat) | Existing fiat portal. Gets read-only access to wallet data through Granville Crypto's API. |

The browser never calls wallet-api directly. All calls flow:

```
Browser → Granville Crypto API → wallet-api → mpcium cluster
```

## Auth

Granville Crypto authenticates backend-to-backend calls with a shared secret:

```
X-Granville-Service-Token: <secret>
```

The secret is configured in both services. All traffic must be over HTTPS.

Both Granville and Granville Crypto use Clerk for user auth. wallet-api does not validate Clerk tokens.

## API contract

The full service interface is documented in [`openapi.yaml`](./openapi.yaml).

Endpoint summary:

| Method | Path | Description |
|---|---|---|
| `POST` | `/service/wallets` | Trigger MPC keygen ceremony |
| `GET` | `/service/wallets` | List all wallets ⚠️ not yet implemented |
| `GET` | `/service/wallets/:id` | Wallet detail + USDC/USDT balances |
| `GET` | `/service/wallets/:id/transactions` | Transaction history (50 max) |
| `POST` | `/service/transactions` | Sign and broadcast a transaction |
| `GET` | `/service/transactions/:id` | Get transaction by ID |
| `POST` | `/service/transactions/:id/cancel` | Cancel a pending transaction |
| `POST` | `/service/transactions/:id/speed-up` | Resubmit with higher gas |
| `GET` | `/service/health/cluster` | MPC node health |
| `GET` | `/service/events` | SSE stream for real-time tx updates |

## Known gaps before production

1. **`GET /service/wallets` is not implemented** — `walletH.ListAll` is referenced in the router but the method was never written. Compile error.
2. **Org scoping is missing** — service token calls store wallets with `user_id = ""`. Multi-org support requires passing and storing an `org_id`.
3. **`wallet_id` is a query param on cancel/speed-up** — `?wallet_id=uuid` rather than a path segment. May want to revisit the route shape.
4. **Path prefix** — the workplan referenced `/api/v1/*`; the actual routes use `/service/*`. The spec and this document treat `/service/*` as the source of truth.

## Supported chains and tokens

| Chain | USDC | USDT |
|---|---|---|
| Ethereum | ✓ | ✓ |
| Polygon | ✓ | ✓ |
| Arbitrum | ✓ | ✓ |
| Optimism | ✓ | ✓ |
| Base | ✓ | — |

## Configuration

Copy `config.yaml.template` to `config.yaml` and fill in:

- `service_token` — shared secret with Granville Crypto
- `database.url` — Postgres connection string
- `redis.url` — Redis connection string
- `mpc.*` — mpcium cluster connection (NATS, threshold, peer names)
- `alchemy.*` — RPC URLs and webhook secret for balance reads and tx confirmation

## Running locally

```bash
docker-compose up -d   # starts Postgres + Redis
go run ./cmd/api
```
