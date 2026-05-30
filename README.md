# mpcium

Internal fork of [fystack/mpcium](https://github.com/fystack/mpcium). This repo is the MPC signing engine that powers the Wallets feature in Granville Crypto.

The engine runs a cluster of MPC nodes that jointly generate and sign with private keys — no single node ever holds a complete key. It is not customer-facing. All calls come from Granville Crypto's backend via a service token.

## What lives here

| Directory | Purpose |
|---|---|
| `cmd/` `pkg/` | Core mpcium engine (upstream, largely unmodified) |
| `wallet-api/` | HTTP service exposing keygen, signing, and wallet reads to Granville Crypto |
| `wallet-frontend/` | Reference UI components migrated into Granville Crypto (not deployed standalone) |

## Integration

See [`INTEGRATION.md`](./INTEGRATION.md) for the six-phase plan covering how mpcium integrates with Granville Crypto and Granville.

See [`wallet-api/README.md`](./wallet-api/README.md) for the service contract, auth model, supported chains, and known gaps.

The full REST API is documented in [`wallet-api/openapi.yaml`](./wallet-api/openapi.yaml).

## Upstream

Base engine: [fystack/mpcium](https://github.com/fystack/mpcium) — threshold signature scheme built on [tss-lib](https://github.com/bnb-chain/tss-lib). Supports ECDSA (secp256k1) for EVM chains.
