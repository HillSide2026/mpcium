# Stablecoin Wallet Integration Plan

> Based on `HillSide2026/mpcium` (fork of `fystack/mpcium`). No code has been changed.

---

## 1. Proposed System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Client Layer                                │
│                                                                      │
│   Mobile App (React Native)          Web App (Next.js / React)      │
│   ─ view balances                    ─ same features, browser        │
│   ─ initiate transfers               ─ admin dashboard               │
│   ─ approve/reject (policy)                                          │
└────────────────────────────┬─────────────────────────────────────────┘
                             │  HTTPS / REST or gRPC
┌────────────────────────────▼─────────────────────────────────────────┐
│                         Wallet API                                   │
│                   (Go service — owns business logic)                 │
│                                                                      │
│   ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│   │  Auth / KYC  │  │ Wallet       │  │  Transaction Builder      │ │
│   │  (JWT, OAuth)│  │ Registry     │  │  ─ build unsigned EVM tx  │ │
│   │              │  │ ─ walletID   │  │  ─ gas estimation         │ │
│   │              │  │ ─ user map   │  │  ─ nonce management       │ │
│   │              │  │ ─ HD paths   │  │  ─ ERC-20 transfer encode │ │
│   └──────────────┘  │ ─ addresses  │  └───────────────────────────┘ │
│                     └──────────────┘                                │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │                      Policy Engine                           │  │
│   │  ─ per-user spending limits (daily / per-tx)                 │  │
│   │  ─ destination address whitelist / blacklist                 │  │
│   │  ─ multi-approval workflows (large transfers)                │  │
│   │  ─ velocity checks                                           │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │              mpcium Go Client  (pkg/client)                  │  │
│   │  ─ CreateWallet(walletID)                                    │  │
│   │  ─ SignTransaction(SignTxMessage)                            │  │
│   │  ─ OnWalletCreationResult / OnSignResult callbacks           │  │
│   └──────────────────────┬───────────────────────────────────────┘  │
└──────────────────────────┼───────────────────────────────────────────┘
                           │  NATS JetStream  (mpc.keygen_request.* /
                           │                   mpc.signing_request.*)
┌──────────────────────────▼───────────────────────────────────────────┐
│                    mpcium Signing Cluster                            │
│              (3 independent nodes — 2-of-3 threshold)               │
│                                                                      │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐                   │
│   │  node0   │     │  node1   │     │  node2   │                   │
│   │ Badger KV│     │ Badger KV│     │ Badger KV│                   │
│   │ key share│     │ key share│     │ key share│                   │
│   └──────────┘     └──────────┘     └──────────┘                   │
│                                                                      │
│   Infrastructure: NATS JetStream + Consul (service discovery)       │
│   Key types: ECDSA secp256k1 (EVM) + EdDSA Ed25519 (Solana)        │
│   Output: R, S, SignatureRecovery (ECDSA) or Signature (EdDSA)      │
└──────────────────────────┬───────────────────────────────────────────┘
                           │  signed tx bytes
          ┌────────────────┴──────────────────┐
          ▼                                   ▼
┌─────────────────────┐           ┌───────────────────────┐
│   Chain RPC Layer   │           │       Indexer         │
│                     │           │                       │
│  Ethereum / EVM:    │           │  ─ poll or webhook    │
│  Alchemy / Infura   │           │  ─ USDC/USDT balances │
│  JSON-RPC           │           │  ─ tx confirmation    │
│                     │           │  ─ on-chain history   │
│  Optional:          │           │  ─ notify Wallet API  │
│  ERC-4337 bundler   │           │    on finality        │
│  (Pimlico/Alto)     │           │                       │
└─────────────────────┘           └───────────────────────┘
```

---

## 2. Exact Boundary: mpcium vs. Wallet Backend

### What mpcium handles (do not re-implement)

| Responsibility | Where in code |
|---|---|
| Distributed key generation (ECDSA + EdDSA) | `pkg/mpc/ecdsa_keygen_session.go`, `eddsa_keygen_session.go` |
| Threshold signing — produces R, S, V bytes | `pkg/mpc/ecdsa_signing_session.go`, `eddsa_signing_session.go` |
| Encrypted key-share storage per node | `pkg/kvstore/badger.go` |
| Node peer authentication (Ed25519 node identity) | `pkg/identity/identity.go` |
| Inter-node message routing | `pkg/messaging/` (NATS pub/sub + point-to-point) |
| Service discovery and health | `pkg/infra/consul.go`, `pkg/healthcheck/` |
| HD child public key derivation from master pubkey | `pkg/ckdutil/child_derivation.go` |
| Key resharing (rotate nodes or threshold) | `pkg/mpc/ecdsa_resharing_session.go`, `eddsa_resharing_session.go` |
| Event initiator signature verification | verifies every incoming `GenerateKeyMessage` / `SignTxMessage` |
| Optional multi-authorizer enforcement | `pkg/types/initiator_msg.go` — `AuthorizerSignature` |
| Duplicate/stale session protection | `ErrorCodeSessionDuplicate`, `ErrorCodeSessionStale` in `pkg/event/types.go` |
| Backup of key shares | `pkg/kvstore/badger_backup.go` |

**mpcium's signing output** — what arrives in `SigningResultEvent`:

```go
type SigningResultEvent struct {
    WalletID          string     // which wallet
    TxID              string     // correlates to your request
    R, S              []byte     // ECDSA signature components
    SignatureRecovery []byte     // recovery byte (v) for EVM
    Signature         []byte     // EdDSA full signature
    ResultType        ResultType // "success" or "error"
    ErrorCode         ErrorCode
}
```

mpcium does **not** know what chain the signature is for, what token is being transferred, or what the transaction means. It signs bytes and returns components.

---

### What the wallet backend must handle (build this)

| Responsibility | Notes |
|---|---|
| **User accounts & auth** | JWT, OAuth2, MFA. mpcium has no concept of users. |
| **Wallet registry** | Map `walletID` (mpcium) → user, chain, derivation path, on-chain address. |
| **Address derivation** | Take `ECDSAPubKey` from `KeygenResultEvent`, compress → keccak256 → EVM address. Use `ckdutil` for child paths. |
| **HD derivation paths** | Define path convention (e.g. `m/44'/60'/accountIndex'/0/addressIndex` for EVM). Call `ckdutil.DeriveSecp256k1ChildCompressed` to get child pubkey, then derive address. Store path in wallet registry. |
| **Unsigned transaction construction** | ABI-encode ERC-20 `transfer(to, amount)`, set nonce, gas price/limit. Produce the signing hash (EIP-155 for legacy, or EIP-1559 type-2). Pass the 32-byte hash in `SignTxMessage.Tx`. |
| **`NetworkInternalCode` mapping** | A string you define that identifies chain (e.g. `"eth-mainnet"`, `"polygon-pos"`). Nodes pass it through; you use it to route broadcasts. |
| **Policy engine** | Spending limits, address whitelist, velocity checks, approvals — evaluated before calling `SignTransaction`. |
| **Signature assembly** | Take R, S, V from `SigningResultEvent` and RLP-encode the final signed EVM transaction. For EdDSA (Solana), attach `Signature` bytes to the serialized transaction. |
| **Transaction broadcast** | Submit the assembled signed tx to the appropriate chain RPC. Handle retry, nonce conflicts, gas bumping. |
| **Idempotency** | Generate a unique `TxID` per signing request. Track state (pending → signed → broadcast → confirmed). |
| **Result persistence** | Store keygen and signing results. Deliver to client via webhook or push notification. |
| **Indexer / balance queries** | Query USDC/USDT balances and transaction history. Alchemy webhooks, The Graph, or Moralis are practical options for MVP. |
| **Event initiator key** | Generate and securely store the initiator Ed25519 or P256 private key. The public key goes in each node's `config.yaml`. |
| **Error handling** | mpcium returns typed `ErrorCode` values — map them to user-facing errors and retry logic. |

---

## 3. Recommended MVP Design — 2-of-3 MPC

### Scope

- **Chains**: Ethereum mainnet + Polygon PoS (both EVM, same key type)
- **Stablecoins**: USDC, USDT (ERC-20)
- **Signing scheme**: ECDSA secp256k1
- **Threshold**: 2-of-3 (`mpc_threshold: 2`, 3 nodes)

### Node topology

```
node0  ─┐
node1  ─┼── NATS JetStream cluster ── Wallet API (mpcium Go client)
node2  ─┘
         └── Consul (service discovery + health)
```

Deploy each node on a separate host or cloud instance. Nodes must not share disk. NATS and Consul can be co-located on a small dedicated VM or managed service for MVP.

### Wallet creation flow

```
1. User requests new wallet (Wallet API)
2. Wallet API generates walletID (UUID)
3. Wallet API calls mpcClient.CreateWallet(walletID)
4. mpcium nodes run 2-of-3 keygen protocol
5. OnWalletCreationResult fires → KeygenResultEvent{ECDSAPubKey, EDDSAPubKey}
6. Wallet API:
   a. derives EVM address from ECDSAPubKey (keccak256 of uncompressed pubkey[1:])
   b. stores walletID + address + pubkey in wallet registry (Postgres)
   c. returns address to user
```

### Signing flow (USDC transfer)

```
1. User submits transfer request (to, amount, token) via Wallet API
2. Policy engine evaluates — pass or reject
3. Transaction Builder:
   a. fetch nonce from chain RPC
   b. estimate gas
   c. ABI-encode ERC-20 transfer(to, amount)
   d. build EIP-1559 tx struct
   e. compute signing hash (keccak256 of RLP-encoded unsigned tx)
4. Wallet API calls mpcClient.SignTransaction(&types.SignTxMessage{
       KeyType:             types.KeyTypeSecp256k1,
       WalletID:            walletID,
       NetworkInternalCode: "eth-mainnet",   // or "polygon-pos"
       TxID:                uuid.New().String(),
       Tx:                  signingHash32Bytes,
       DerivationPath:      []uint32{},      // root key for MVP; use path for HD
   })
5. OnSignResult fires → SigningResultEvent{R, S, SignatureRecovery}
6. Wallet API assembles signed tx: RLP-encode with r, s, v
7. Broadcast to chain RPC (eth_sendRawTransaction)
8. Poll/webhook for confirmation; update tx state; notify user
```

### HD derivation strategy

For MVP, one `walletID` per user at the root key (no derivation path needed). When you need per-chain or per-account isolation:

```
DerivationPath: []uint32{44, 60, accountIndex, 0, addressIndex}
```

Pass this in `SignTxMessage.DerivationPath`. mpcium calls `ckdutil.DeriveSecp256k1ChildCompressed` internally during signing to derive the correct child key. The `chain_code` (32-byte hex, same on all nodes) must be set in each node's `config.yaml` before first keygen.

### Policy engine — MVP rules

| Rule | Implementation |
|---|---|
| Max single transfer | configurable per user tier, checked before signing |
| Daily spend limit | rolling 24h sum from confirmed tx history |
| Destination whitelist | optional per-wallet allowlist stored in Postgres |
| Token allowlist | only USDC / USDT contract addresses accepted |

Reject at policy layer — do not call `SignTransaction` if policy fails.

### Infrastructure checklist (pre-launch)

- [ ] Generate initiator Ed25519 keypair: `mpcium-cli generate-initiator`
- [ ] Generate node identities: `mpcium-cli generate-identity -n node0` (×3)
- [ ] Register peers: `mpcium-cli register-peers`
- [ ] Set shared `chain_code` (same 32-byte hex in all node configs)
- [ ] Set `mpc_threshold: 2` in all node configs
- [ ] NATS JetStream with persistence enabled
- [ ] Consul with health checks
- [ ] Badger backup enabled (`backup_enabled: true`, off-node backup destination)
- [ ] Wallet API holds initiator private key in secrets manager (AWS Secrets Manager, HashiCorp Vault)
- [ ] Separate Postgres for wallet registry, user accounts, tx state
- [ ] Indexer configured for USDC/USDT contract addresses on target chains

### What to build first (suggested order)

1. **mpcium cluster** — stand up 3 nodes locally with Docker Compose, run the e2e keygen + sign tests to confirm the cluster works
2. **Wallet API skeleton** — embed mpcium Go client, implement `CreateWallet` + address derivation
3. **Transaction builder** — unsigned EVM tx construction + signing hash computation
4. **Signature assembly + broadcast** — take R/S/V, RLP-encode, send to RPC
5. **Wallet registry** — Postgres, walletID ↔ address ↔ user
6. **Policy engine** — spending limits and destination filter
7. **Indexer** — Alchemy webhooks or polling for USDC/USDT balance and confirmation
8. **Mobile/web client** — connect to Wallet API REST endpoints

---

## Key files to study before building

| File | Why |
|---|---|
| [pkg/client/client.go](pkg/client/client.go) | The Go interface your Wallet API embeds |
| [pkg/types/initiator_msg.go](pkg/types/initiator_msg.go) | `SignTxMessage` fields — what you must populate |
| [pkg/event/sign.go](pkg/event/sign.go) | `SigningResultEvent` — what you get back |
| [pkg/event/keygen.go](pkg/event/keygen.go) | `KeygenResultEvent` — pubkeys returned after wallet creation |
| [pkg/ckdutil/child_derivation.go](pkg/ckdutil/child_derivation.go) | HD derivation — only non-hardened paths supported |
| [examples/generate/main.go](examples/generate/main.go) | Minimal working keygen example |
| [examples/sign/main.go](examples/sign/main.go) | Minimal working signing example |
| [config.yaml.template](config.yaml.template) | All node config options including `chain_code` |
