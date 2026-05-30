# Wallet Frontend Roadmap

Reviewed against: BlueWallet, Rainbow wallet  
Current state: Next.js web app, BlueWallet-inspired design, live 2-of-3 MPC backend

---

## P0 — MPC Security as the Product

The app's core differentiator — threshold signatures, no single point of failure — is completely invisible today. A user who registers and sees zero balances has no idea why they'd choose this over MetaMask. These items turn the technical advantage into the product story.

### 1. Wallet creation ceremony
**What:** Replace the loading spinner during MPC keygen (~10s) with a live step-through that shows the 3-node protocol running.

**How:**
- Stream fake-but-accurate progress events client-side, timed to the real keygen duration:
  - `0s` → "Connecting to signing cluster…"
  - `2s` → "Node 1 generating key share…"
  - `4s` → "Node 2 generating key share…"
  - `6s` → "Node 3 generating key share…"
  - `8s` → "Distributing shares across nodes…"
  - `done` → "✓ Wallet created. Your key is split — no single node can sign alone."
- Animate three node dots lighting up in sequence with a connecting line diagram
- Add one-line explainer: *"2-of-3 nodes must cooperate to sign any transaction. No individual ever holds your full key."*

**Why:** The 10-second wait already happens. Surface it as the trust signal, not an awkward delay. First-time users remember it; returning users can skip the animation.

---

### 2. Dashboard trust header
**What:** Persistent strip above the wallet carousel showing cluster health and the security guarantee.

**Design:**
```
● node0  ● node1  ● node2    Protected by 2-of-3 MPC · Key never assembled
```
- Three green dots (or amber/red if a node goes offline — ping `/health` on each node)
- Clicking the strip opens a one-screen explainer: "What is MPC and why does it matter?"
- On first login: expanded with animation; collapses to compact strip on return visits (localStorage flag)

**Why:** Differentiates at a glance. Every screen where the strip is visible reinforces the security story passively.

---

### 3. Confirm-page signature theater
**What:** On "Confirm & Sign," show a mini animated diagram of the 2-of-3 MPC signing protocol while the signing is actually happening.

**Design:**
- Three node circles connected by lines
- As signing progresses: nodes light up one by one, connection lines animate
- "2 of 3 nodes signed" counter appears when quorum is reached
- Transitions to a green checkmark "Signed" when `SigningResultEvent` returns

**Why:** Signing is already happening server-side (~5–15 seconds). Show the ceremony. Makes the wait feel like a feature, makes the app feel different from any other wallet. Rainbow uses animated feedback at every step; this is our equivalent.

---

### 4. Empty-state onboarding
**What:** First-time dashboard (no wallets) should explain MPC in one sentence and make creating a wallet feel intentional.

**Design:**
```
[Shield icon]
Your keys, split — never whole

This wallet uses threshold cryptography. 3 servers each
hold a fragment of your key. Any 2 must cooperate to sign.
No single server can steal your funds.

[ Create your first wallet ]
```
- Replace current "No wallets yet" grey text
- One action only: create wallet

---

## P1 — UX Completeness (Rainbow-inspired)

Rainbow's premium feel comes from three things: animated number transitions on every balance change, comprehensive transaction detail/status, and USD value everywhere. These items close the gap.

### 5. USD portfolio value
**What:** Show total USD value on the dashboard above the carousel.

**How:**
- Fetch USDC/USDT price from CoinGecko free API (`/simple/price?ids=usd-coin,tether&vs_currencies=usd`) — both are ~$1.00 but may briefly depeg
- Sum: `totalUSD = (usdcRaw / 1e6 × usdcPrice) + (usdtRaw / 1e6 × usdtPrice)`
- Display: `$12,450.23` in large bold type above the carousel
- Refresh every 60s; animate the number change (Rainbow uses `react-native-animated-number`; web equivalent: `react-spring` counter or CSS counter animation)

### 6. Animated balance counters
**What:** When balances load or update (e.g. after a receive), the number ticks up rather than snapping — Rainbow's signature touch.

**How:** Use `react-spring` to animate the numeric value from 0 → actual balance on mount, and from old → new value on update. ~30 lines of code, huge perceived quality uplift.

### 7. Transaction speed-up / cancel
**What:** For `broadcast` status transactions, show "Speed up" (bump gas) and "Cancel" (send 0-value tx to self with higher gas) options.

**How:** Requires the wallet API to support `PUT /transactions/:id/cancel` and `/speed-up`. EIP-1559 transactions can be replaced by submitting the same nonce with higher `maxPriorityFeePerGas`.

### 8. Pull-to-refresh / manual balance refresh
**What:** A refresh button on the dashboard carousel that re-fetches balances from RPC. Currently balances only update via Alchemy webhooks.

**How:** Invalidate `wallets-with-balances` TanStack Query key. With Alchemy keys configured, also calls `eth_call balanceOf` directly.

### 9. Activity watcher — real-time incoming
**What:** When a user is on the dashboard, detect incoming transfers via the SSE stream and show a toast: *"+50 USDC received"* with the balance updating live.

**How:** The SSE `tx_confirmed` event already fires for outbound txs. Extend the Alchemy webhook handler to also emit SSE events for inbound transfers. The `SSEProvider` already broadcasts to all connected clients.

---

## P2 — Product Depth

### 10. Token price chart
**What:** Tapping a wallet card opens a 7/30/90-day price chart for USDC/USDT.
**Source:** CoinGecko `/coins/{id}/market_chart` endpoint (free, no key required).
**Library:** `recharts` (lightweight, works in Next.js without canvas issues).

### 11. WalletConnect / dApp browser
**What:** Let users connect their MPC wallet to any DeFi dApp via WalletConnect v2.
**How:** The wallet API handles signing; WalletConnect relays the `eth_signTransaction` request to our API. This requires the wallet API to expose a WalletConnect session endpoint. Significant build.

### 12. Hardware wallet as a node
**What:** Replace one of the 3 MPC nodes with a Ledger or Trezor, so the user physically controls one key share.
**Note:** Requires changes to the mpcium node protocol — would be a contribution upstream.

### 13. Multi-chain expansion
**What:** Add support for more chains using the same MPC wallet (via HD derivation paths already in mpcium).
- Arbitrum, Base, Optimism: same secp256k1 key, same address
- Solana: EdDSA key already generated by mpcium alongside ECDSA — just needs Solana broadcasting

### 14. Mobile app (React Native)
**What:** Native iOS/Android app using the same wallet-api backend.
**Stack:** Expo + React Native, same TanStack Query hooks, Reanimated 3 for the node animation and balance counters.
**Note:** This is where the BlueWallet/Rainbow-style carousel truly shines — the web approximation with CSS scroll-snap is good but native scroll physics feel significantly better.

---

## Implementation Priority

| # | Item | Effort | Impact |
|---|---|---|---|
| 1 | Wallet creation ceremony | S | ★★★★★ |
| 2 | Dashboard trust header | S | ★★★★★ |
| 4 | Empty-state onboarding | XS | ★★★★☆ |
| 3 | Confirm-page signature theater | M | ★★★★☆ |
| 5 | USD portfolio value | S | ★★★★☆ |
| 6 | Animated balance counters | XS | ★★★☆☆ |
| 9 | Activity watcher SSE inbound | S | ★★★☆☆ |
| 8 | Manual balance refresh | XS | ★★★☆☆ |
| 7 | Speed-up / cancel | M | ★★★☆☆ |
| 10 | Price chart | M | ★★☆☆☆ |
| 11 | WalletConnect | L | ★★★★☆ |
| 13 | Multi-chain expansion | M | ★★★☆☆ |
| 14 | Mobile app (React Native) | XL | ★★★★★ |
| 12 | Hardware wallet as node | XL | ★★★☆☆ |

**Recommended first sprint:** Items 1, 2, 4, 5, 6 — all are S/XS effort, collectively transform how a new user perceives the product in their first 60 seconds.
