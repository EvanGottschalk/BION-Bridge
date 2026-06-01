# 1 — Initial Relay Integration Plan

> Status: **Draft, pending review**
> Scope: Turn the current demo bridge UI into a working cross-chain swap, powered by Relay, across **Solana, Base, and Ethereum mainnets**.
> Target users: Wallet holders moving any supported token from one of these three chains to any of the others (or to a different token on the same destination chain).

---

## 1. Goals & Non-Goals

### Goals
1. Replace the faked bridge flow in `components/bridge/bridge-card.tsx` with a real, Relay-powered, any-to-any cross-chain swap across **Ethereum, Base, and Solana** mainnets.
2. Add real wallet connection (EVM + Solana) that replaces the toggle stub in `components/bridge/header.tsx`.
3. Introduce token selection on both sides of the swap, seeded by the existing `config/token_info/*` tables and augmented dynamically via Relay's `/currencies/v2`.
4. Wire Relay app fees on every quote, paid to `RELAY_FEE_RECIPIENT` (already defined in `config/fees_config.ts`).
5. Keep everything **config-driven** per `CLAUDE.md` rule #1 — every endpoint, chain id, bps value, token list, and feature flag lives in `config/*.ts`.
6. Stay **mobile-first and responsive** per `CLAUDE.md` rule #2.

### Non-Goals (deferred to later plans)
- Testnet support (Sepolia / Base Sepolia / Solana Devnet). Configs exist, but UI will hide them.
- Same-chain swaps (Relay supports them — covered by `SWAP_PROVIDER_OPTIONS` referencing 0x/Jupiter, not Relay). This plan targets cross-chain only.
- Other Relay chains (Polygon, Arbitrum, Optimism, etc.). Easy to add once the three-chain version works.
- App-fee claiming UI (`/app-fees/{wallet}/claim`). Balance accrues in Relay; we'll add an admin claim screen in a later plan.
- Recent-bridges history, real stats bar numbers, transaction explorer.
- Account abstraction / gasless flows (EIP-7702, 4337). Standard EOA signing only.

### Out of scope but worth flagging
- The current `app/page.tsx` and `bridge-card.tsx` are themed around a "BION token bridge." Since BION isn't in any of our token configs and the user-confirmed scope is **any-to-any tokens**, this plan retires the BION-locked input in favor of token selectors. The page copy/branding can stay (AEX, Bion DAO, etc.); the *mechanism* becomes generic.

---

## 2. Architecture overview

### 2.1 The Relay flow (per `Quickstart - Relay.pdf`)

```
[Configure chains]
       │
       ▼
[Quote]   POST /quote/v2     — calculates route, fees, returns steps[]
       │
       ▼
[Execute] Iterate steps[]    — for each step.item:
       │                       - kind=transaction → wallet.sendTx(data,to,value,chainId)
       │                       - kind=signature   → wallet.signMessage(message)
       ▼
[Monitor] GET /intents/status/v3?requestId=...
       │                       Poll once/sec until status ∈ {success, failure, refunded}
       ▼
[Done]
```

A single Relay quote works for both **bridge** (same currency, different chain) and **swap** (different currency, same or different chain). No branching needed in our app.

### 2.2 New module layout

```
lib/
  relay/
    client.ts           # fetch wrappers for /quote/v2, /intents/status/v3, /currencies/v2, /chains, /app-fees/*
    quote.ts            # buildQuoteRequest(args) → QuoteRequest; parseQuote(resp) → DisplayQuote
    execute.ts          # executeSteps(steps, evmWallet, svmWallet) — iterates step items, dispatches by kind
    status.ts           # pollStatus(requestId, onUpdate) — 1s poll, calls onUpdate(status), resolves on terminal
    types.ts            # TS types for QuoteRequest, QuoteResponse, Step, StatusResponse, AppFee
    chains.ts           # maps our internal CHAINS keys ↔ Relay chain ids (already partly in config/chain_info.ts)
  wallets/
    evm.ts              # wagmi config: chains [mainnet, base], RPC from config, connectors
    svm.ts              # Solana wallet-adapter setup: Phantom, Solflare, Backpack
    provider.tsx        # <WalletProviders> client component wrapping the tree
    use-active-wallet.ts # hook returning {evm: {address, signer}, svm: {publicKey, signer}}

app/
  providers.tsx         # NEW client component: WagmiProvider + RainbowKitProvider + SolanaWalletProvider + QueryClient
  layout.tsx            # wrap children in <Providers>

components/bridge/
  bridge-card.tsx       # rewritten: token + chain selectors, debounced quote, execute button
  chain-selector.tsx    # extended: drives off config/chain_info.ts (ethereum, base, solana only for now)
  token-selector.tsx    # NEW: modal/popover. Seeded from config/token_info/*, can search via Relay /currencies/v2
  quote-summary.tsx     # NEW: shows route, fees breakdown (gas + relayer + relay + app), ETA, slippage
  swap-progress.tsx     # NEW: stepper modal — Approve / Sign / Deposit / Filling / Done, driven by status poll
  connect-button.tsx    # NEW: replaces the toggle in header.tsx. RainbowKit for EVM, custom button for SVM,
                        # or a single combined "Connect" that picks based on selected origin chain

config/
  relay_config.ts       # NEW: API base url, polling interval, default slippage, app-fee bps, default tokens per chain
                        # cross-references RELAY_FEE_RECIPIENT and UNIVERSAL_FEES.ALL from fees_config.ts
  chain_info.ts         # already has RELAY_CHAIN_INFO; extend with the 3 active chain UI metadata (display name, icon key, vmType)
```

### 2.3 Data flow at runtime

1. User selects **From chain**, **From token**, **To chain**, **To token**, **Amount**.
2. Hook `useRelayQuote(input)` debounces 400 ms → POSTs `/quote/v2`. While in flight, `QuoteSummary` shows skeleton.
3. Response populates `QuoteSummary` (output amount, USD impact, fees breakdown, ETA from `details.timeEstimate`).
4. User clicks **Swap**. We open `SwapProgress`, then call `executeSteps(quote.steps, walletEvm, walletSvm)`:
   - For each `step.items[i]` with `kind: "transaction"`: build the tx from `data.{to, data, value, chainId}` and submit via the wallet matching `chainId`. EVM uses viem; Solana uses the Relay SVM wallet adapter (calldata format differs, per Solana support doc).
   - For `kind: "signature"`: sign per `signatureKind` (typically EIP-712 permit on EVM).
5. As soon as the deposit tx hash is known, take `step.items[i].check.endpoint` (= `/intents/status?requestId=…`) **or** use `requestId` directly against `/intents/status/v3` and start `pollStatus`. UI advances through `waiting → pending → submitted → success | failure | refunded | delayed`.
6. On `success`, show the destination explorer link (from `RELAY_CHAIN_INFO[chain].explorerUrl` + tx hash from `status.txHashes[0]`).

### 2.4 Wallet stack (RainbowKit + Solana adapter — confirmed)

- **EVM**: `wagmi` + `viem` + `@rainbow-me/rainbowkit` for the modal. Chains = `[mainnet, base]`, transports built from `BLOCKCHAIN.ETH_MAINNET.rpcUrls` and `BLOCKCHAIN.BASE_MAINNET.rpcUrls` via the existing `resolveRpcUrls()` helper in `config/chain_info.ts`.
- **Solana**: `@solana/wallet-adapter-react` + `@solana/wallet-adapter-react-ui` for the connect modal, with `Phantom`, `Solflare`, `Backpack` adapters. RPC endpoint from `SOLANA_MAINNET.rpcUrls`.
- **Signing & broadcasting Solana steps**: Relay's Solana steps return **non-standard calldata** (per `Solana Support - Relay.pdf` — base64 transaction blobs, not EVM-style `{to,data,value}`). We will either:
  - Decode and submit via `@solana/web3.js` directly (lowest-dep route), **or**
  - Install `@relayprotocol/relay-svm-wallet-adapter` which handles signing/broadcasting per Relay's docs.
  - **Decision deferred to implementation**; reading Relay's SVM adapter source first will decide.
- A single **Connect** button in the header opens **both** modals depending on the active origin chain's vmType (EVM → RainbowKit; SVM → Solana wallet modal). The header keeps two address pills if both are connected.

---

## 3. Config changes (per `CLAUDE.md` non-negotiable #1)

All new literals live in config files. No URLs, chain ids, or bps values in components.

### 3.1 New file: `config/relay_config.ts`

```ts
// Endpoints
export const RELAY_API_BASE = 'https://api.relay.link';
export const RELAY_QUOTE_PATH = '/quote/v2';
export const RELAY_STATUS_PATH = '/intents/status/v3';
export const RELAY_CURRENCIES_PATH = '/currencies/v2';
export const RELAY_CHAINS_PATH = '/chains';
export const RELAY_APP_FEES_BALANCE_PATH = (wallet: string) => `/app-fees/${wallet}/balances`;
export const RELAY_APP_FEES_CLAIM_PATH = (wallet: string) => `/app-fees/${wallet}/claim`;

// API auth (optional, higher rate limits)
export const RELAY_API_KEY_ENV = 'NEXT_PUBLIC_RELAY_API_KEY';

// Polling
export const RELAY_STATUS_POLL_INTERVAL_MS = 1000;
export const RELAY_STATUS_POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 min hard ceiling

// Slippage & UX
export const RELAY_DEFAULT_SLIPPAGE_BPS: number | null = null; // null = let Relay auto-calc
export const RELAY_QUOTE_DEBOUNCE_MS = 400;
export const RELAY_QUOTE_REFRESH_MS = 20_000; // refresh stale quote every 20 s

// Tradetype default
export const RELAY_DEFAULT_TRADE_TYPE = 'EXACT_INPUT' as const;

// App fees — pulled from fees_config.ts so there's a single source of truth for the recipient & bps value.
// Bps = basis points (1 bp = 0.01%). UNIVERSAL_FEES.ALL is currently 0.5 (interpreted as 50 bps = 0.5%).
// See: docs/external_docs/Relay Docs/Taking Transaction Fees/App Fees.pdf
export const RELAY_APP_FEE_BPS = 50; // 0.5% — confirm with product before launch
// recipient comes from RELAY_FEE_RECIPIENT in fees_config.ts

// Native currency sentinel addresses (per Relay quickstart)
export const NATIVE_EVM_ADDRESS = '0x0000000000000000000000000000000000000000';
export const NATIVE_SOL_ADDRESS = '11111111111111111111111111111111';
```

### 3.2 New file: `config/active_chains.ts`

Drives the UI's chain selector. Avoids hardcoding the three-chain list in `chain-selector.tsx`.

```ts
import { ETH_MAINNET, BASE_MAINNET, SOLANA_MAINNET, RELAY_CHAIN_INFO } from './chain_info';

export type VmType = 'evm' | 'svm';

export const ACTIVE_CHAINS = [
  {
    key: 'ethereum',
    displayName: 'Ethereum',
    relayChainId: RELAY_CHAIN_INFO.ethereum.chainId,     // 1
    vmType: 'evm' as VmType,
    explorerUrl: ETH_MAINNET.explorerUrl,
    rpcUrls: ETH_MAINNET.rpcUrls,
    iconKey: 'ethereum',
  },
  {
    key: 'base',
    displayName: 'Base',
    relayChainId: RELAY_CHAIN_INFO.base.chainId,         // 8453
    vmType: 'evm' as VmType,
    explorerUrl: BASE_MAINNET.explorerUrl,
    rpcUrls: BASE_MAINNET.rpcUrls,
    iconKey: 'base',
  },
  {
    key: 'solana',
    displayName: 'Solana',
    relayChainId: RELAY_CHAIN_INFO.solana.chainId,       // 792703809
    vmType: 'svm' as VmType,
    explorerUrl: SOLANA_MAINNET.explorerUrl,
    rpcUrls: SOLANA_MAINNET.rpcUrls,
    iconKey: 'solana',
  },
] as const;

export type ActiveChainKey = (typeof ACTIVE_CHAINS)[number]['key'];
```

Polygon's `comingSoon: true` entry in `chain-selector.tsx` is **removed** — it doesn't match the confirmed scope. If the user later wants Polygon back, it's a one-line addition.

### 3.3 New file: `config/token_info/index.ts`

Aggregates per-chain token tables under a single map keyed by `ActiveChainKey`.

```ts
import type { ChainTokens } from './types';
import * as ethTokens from './eth_tokens';
import * as baseTokens from './base_tokens';
import * as solanaTokens from './solana_tokens';

const buildMap = (mod: Record<string, unknown>): ChainTokens =>
  Object.values(mod)
    .filter((t): t is { symbol: string; address: string } => typeof t === 'object' && t !== null && 'symbol' in t)
    .reduce((acc, t: any) => ({ ...acc, [t.symbol.toUpperCase()]: t }), {});

export const TOKENS_BY_CHAIN = {
  ethereum: buildMap(ethTokens),
  base: buildMap(baseTokens),
  solana: buildMap(solanaTokens),
} as const;

// Featured tokens shown at the top of each chain's selector
export const FEATURED_TOKENS_BY_CHAIN = {
  ethereum: ['ETH', 'USDC', 'USDT', 'WETH', 'WBTC', 'DAI'],
  base: ['ETH', 'USDC', 'WETH', 'cbETH', 'DAI'],
  solana: ['SOL', 'USDC', 'USDT', 'WSOL', 'WETH'],
} as const;
```

Tokens outside these tables are still reachable via Relay's `/currencies/v2` search inside `TokenSelector`.

### 3.4 Edits to existing files
- `config/fees_config.ts`: no schema change, but the integration **reads** `RELAY_FEE_RECIPIENT` and `BRIDGING_FEES.Relay.crossChainSwap` (currently `null` — set to a number if we want per-action overrides). Add a comment pointing at `relay_config.ts`.
- `config/blockchain_config.ts`: no required edits. `SWAP_PROVIDER_OPTIONS.CROSS_CHAIN_SWAP = ['Relay']` is already correct.

### 3.5 New env vars (Vercel + `.env.local`)
- `NEXT_PUBLIC_RELAY_API_KEY` — optional, increases rate limits per Quickstart.
- `NEXT_PUBLIC_WC_PROJECT_ID` — required by RainbowKit (WalletConnect Cloud project id).
- (Existing) `NEXT_PUBLIC_ALCHEMY_API_KEY`, `NEXT_PUBLIC_HELIUS_API_KEY` already wired through `resolveRpcUrls`.

---

## 4. Component-level changes

### 4.1 `app/layout.tsx`
Wrap children in a new client `<Providers>` that mounts WagmiProvider + RainbowKitProvider + Solana WalletProvider + a TanStack QueryClient (used by both wagmi and our quote hook).

### 4.2 `components/bridge/header.tsx`
- Remove the fake `useState(walletConnected)` toggle.
- Replace with `<ConnectButton />` (new component). When neither wallet is connected: "Connect Wallet". When one is connected: show that address. When both are connected: show two compact pills (one per vm). Mobile shows just the icon + truncated address.

### 4.3 `components/bridge/chain-selector.tsx`
- Drive `chains` array off `ACTIVE_CHAINS` instead of the hardcoded list.
- Drop the embedded `<SolanaIcon/>` / `<BaseIcon/>` / `<PolygonIcon/>` SVGs into a sibling `chain-icons.tsx` file (still per-chain, but reusable across token selector pills and progress modal).

### 4.4 `components/bridge/token-selector.tsx` (NEW)
- Trigger button shows token symbol + logo (or "Select token" placeholder).
- Modal with search box. List = featured tokens (top), then full chain list, then `/currencies/v2` external search results when the user types. Debounced 250 ms.
- Imported by `bridge-card.tsx` once for each side.

### 4.5 `components/bridge/bridge-card.tsx`
Rewrite. State shape:

```ts
type BridgeState = {
  fromChain: ActiveChainKey;
  toChain: ActiveChainKey;
  fromToken: TokenInfo | null;
  toToken: TokenInfo | null;
  amount: string; // human units
  recipient?: string; // defaults to connected wallet on `toChain.vmType`
};
```

Derived state via `useRelayQuote(state)`:
```ts
type QuoteState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready', quote: ParsedQuote }
  | { kind: 'error', message: string };
```

The big **Bridge** button becomes:
- Disabled while `kind !== 'ready'` or wallet not connected on origin.
- Label: "Connect wallet" / "Select tokens" / "Enter amount" / "Swap {symA} → {symB}" / "Swapping…" depending on state.

Swap chains arrow swaps both chain AND token state.

MAX button: needs wallet balance. Out of scope for v1 — leave as a placeholder that fills the user's full origin token balance once balance fetching is added (deferred to a follow-up plan).

### 4.6 `components/bridge/quote-summary.tsx` (NEW)
Renders `details.currencyOut.amountFormatted`, `fees.gas / fees.relayer / fees.relay / fees.app` (USD), `timeEstimate`, `slippageTolerance.destination.percent`, and a "rate" line. Skeleton state while quote is loading. Mobile: collapsed under a "Details" disclosure.

### 4.7 `components/bridge/swap-progress.tsx` (NEW)
Stepper aligned with Relay's status lifecycle:

| API status | UI label                  |
|------------|---------------------------|
| (pre-tx)   | "Awaiting wallet…"        |
| `waiting`  | "Submitting deposit…"     |
| `pending`  | "Solver filling…"         |
| `submitted`| "Destination tx sent"     |
| `success`  | "Complete" + explorer link|
| `delayed`  | "Taking longer than usual"|
| `failure`  | "Failed" + refund info    |
| `refunded` | "Refunded to {address}"   |

Driven by `pollStatus`. Closes on terminal state or user dismiss.

### 4.8 `components/bridge/stats-bar.tsx`
**Leave the demo numbers in place** for v1. Real stats (volume, bridge count) require an indexer or `/requests/v2` query we're not building in this plan. Note this in code as a placeholder. (Adding real numbers can be a follow-up plan.)

---

## 5. Quote request — the exact shape we'll send

Per `Get Quote - Relay.pdf` + `Solana Support - Relay.pdf`, with our app fee plugged in:

```ts
const body = {
  user: originAddress,                  // EVM addr if originChain.vmType==='evm', else SVM addr
  originChainId: ACTIVE_CHAINS[fromChain].relayChainId,
  destinationChainId: ACTIVE_CHAINS[toChain].relayChainId,
  originCurrency: fromToken.address || NATIVE_EVM_ADDRESS,           // or NATIVE_SOL_ADDRESS for native SOL
  destinationCurrency: toToken.address || NATIVE_EVM_ADDRESS,
  amount: toBaseUnits(amount, fromToken.decimals).toString(),         // smallest-unit string, e.g. wei
  tradeType: RELAY_DEFAULT_TRADE_TYPE,                                // 'EXACT_INPUT'
  recipient: recipient ?? destinationAddress,                         // case-sensitive for Solana
  refundTo: originAddress,                                            // refund on origin chain on failure
  appFees: [
    { recipient: RELAY_FEE_RECIPIENT, fee: String(RELAY_APP_FEE_BPS) }, // single fee for v1
  ],
  // slippageTolerance: omitted → Relay auto-calculates (front-running protection)
};
```

Notes:
- **Solana recipient addresses are case-sensitive** and **must be base58 Solana addresses, not 0x EVM addresses** (per Solana Support doc).
- For Solana **as destination**, we read `recipient` from the connected Solana wallet — even if the origin chain is EVM. The same goes in reverse.
- For native ETH on EVM, `originCurrency` is the zero address `0x000…000`. For native SOL on Solana, the doc shows `1111…1111` (32 ones). We expose both as `NATIVE_*` constants and the token configs use empty string `''` for native today — `quote.ts` translates appropriately.

---

## 6. Execute step — handling the steps array

Per `Quickstart - Relay.pdf` "Understanding Step Execution":

```ts
async function executeSteps(steps: Step[], evm: EvmSigner | null, svm: SvmSigner | null) {
  for (const step of steps) {
    for (const item of step.items) {
      if (item.status === 'complete') continue;
      if (step.kind === 'transaction') {
        const { chainId, to, data, value, maxFeePerGas, maxPriorityFeePerGas } = item.data;
        if (isEvmChainId(chainId)) {
          if (!evm) throw new Error('EVM wallet required');
          const txHash = await evm.sendTransaction({ chainId, to, data, value, maxFeePerGas, maxPriorityFeePerGas });
          yield { kind: 'tx', chainId, txHash, requestId: step.requestId };
        } else if (isSolanaChainId(chainId)) {
          if (!svm) throw new Error('Solana wallet required');
          // item.data is base64-encoded VersionedTransaction (per Relay SVM docs)
          const sig = await svm.signAndSend(item.data);
          yield { kind: 'tx', chainId, txHash: sig, requestId: step.requestId };
        }
      } else if (step.kind === 'signature') {
        // EIP-712 permit (e.g. for permit2/USDC permit-style approvals)
        const sig = await evm!.signTypedData(item.data);
        // Some signatures need POST /execute/permits (see Submit Permit doc)
        if (item.data.post) await postPermit(item.data.post.endpoint, sig, step.requestId);
      }
    }
  }
}
```

This is intentionally a sketch — the implementation will follow Relay's "Understanding Step Execution" doc more strictly when written. The key principle is: **iterate, dispatch on `kind`, never assume EVM**.

---

## 7. Status polling

Per `Get Status - Relay.pdf`:
- `GET https://api.relay.link/intents/status/v3?requestId={requestId}`
- Statuses: `waiting | pending | submitted | success | delayed | refunded | failure` (plus a `refund` enum variant).
- Poll once per second; stop on `success | failure | refunded` (terminal) or our 10-minute timeout.
- A WebSocket stream exists ("subscribe to Relay's…") — the PDF cuts off the link, so v1 uses polling. WS upgrade is a later optimization.

```ts
async function pollStatus(requestId: string, onUpdate: (s: StatusResponse) => void) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < RELAY_STATUS_POLL_TIMEOUT_MS) {
    const resp = await fetch(`${RELAY_API_BASE}${RELAY_STATUS_PATH}?requestId=${requestId}`);
    const status: StatusResponse = await resp.json();
    onUpdate(status);
    if (['success', 'failure', 'refunded'].includes(status.status)) return status;
    await sleep(RELAY_STATUS_POLL_INTERVAL_MS);
  }
  throw new Error('Status poll timed out');
}
```

---

## 8. App fees — implementation & verification

Per `App Fees - Relay.pdf`:
- `appFees: [{ recipient, fee }]` on every quote. `recipient` **must be EVM** even when origin/destination is Solana (we use `RELAY_FEE_RECIPIENT`, an EVM address).
- Fees accrue **off-chain in USDC** in Relay's ledger keyed by `RELAY_FEE_RECIPIENT`.
- For cross-chain swaps (our case), all chain combinations are supported with no fee floor caveats — same-chain SVM/SUI have edge cases we don't hit.
- Threshold: fees < $0.025 may not be collected. With 50 bps and any swap over ~$5 USD we're safely above the floor.
- **Verification (per Relay doc):** call `/requests/v2` and inspect `paidAppFees`. If `appFees` is present but `paidAppFees` is empty/zero, the fee wasn't collected. Add a manual sanity-check script in `lib/relay/verify-fees.ts` (script, not UI) that hits this for a known recent request id. Run it after each environment promotion.

Withdrawal/claim flow is **out of scope for v1**.

---

## 9. Dependencies to add

```
@rainbow-me/rainbowkit
wagmi
viem
@tanstack/react-query
@solana/web3.js
@solana/wallet-adapter-base
@solana/wallet-adapter-react
@solana/wallet-adapter-react-ui
@solana/wallet-adapter-wallets   # bundles Phantom, Solflare, Backpack
```

Possibly:
- `@relayprotocol/relay-svm-wallet-adapter` — install only if reading its source shows it simplifies our Solana execution path. Decide during implementation.

The Next.js 16 / React 19 / Tailwind 4 stack is already in place; all of the above are compatible.

---

## 10. Phased delivery

Roughly five PRs, each independently shippable & testable:

### Phase 1 — Config & types (foundation)
- Add `config/relay_config.ts`, `config/active_chains.ts`, `config/token_info/index.ts`.
- Add `lib/relay/types.ts` (Quote types, Step types, Status types).
- Add `lib/relay/client.ts` (thin fetch wrapper with API-key header).
- **Test:** unit-call `/chains` and `/currencies/v2` from a script; confirm types match.

### Phase 2 — Wallet plumbing
- Add `lib/wallets/*` and `app/providers.tsx`.
- Wrap `app/layout.tsx`.
- Replace header connect toggle with `<ConnectButton />`.
- **Test:** Connect & disconnect Phantom + Rabby/MetaMask on the live UI. Switch networks. Confirm address pills update.

### Phase 3 — Quote read path (no execution)
- Add `lib/relay/quote.ts` + `useRelayQuote` hook.
- Add `TokenSelector` and rewire `BridgeCard` to use chain + token selectors.
- Add `QuoteSummary`.
- Disable the swap button — quote-only.
- **Test:** Pick ETH-on-Base → USDC-on-Solana, $1. Confirm output amount, fees breakdown, and ETA match Relay's hosted bridge UI for the same input. Try every chain pair (3×3 = 9 routes; 6 cross-chain, 3 same-chain that we'll reject in UI).

### Phase 4 — Execute + status (the swap actually works)
- Add `lib/relay/execute.ts` and `lib/relay/status.ts`.
- Add `SwapProgress` modal.
- Hook into the Swap button.
- **Test on mainnet with tiny amount** ($1–2 equivalent). Test matrix:
  - ETH (mainnet) → USDC (Base) — EVM→EVM
  - USDC (Base) → SOL (Solana) — EVM→SVM
  - SOL (Solana) → ETH (mainnet) — SVM→EVM
  - Force a failure (insufficient balance) — confirm refund path.

### Phase 5 — Polish + app fee verification
- Confirm `appFees` is present on every quote and `paidAppFees` shows up in `/requests/v2` for completed swaps.
- Mobile QA pass on all breakpoints.
- Error states: API down, wallet rejection, RPC timeout, status poll timeout.
- Remove the `Polygon "Coming Soon"` entry from any place it lingers.

---

## 11. Known risks / open questions

| # | Risk / question | Mitigation / how we'll resolve |
|---|---|---|
| 1 | Solana step execution format isn't fully documented in the PDFs (just says "different calldata"). | Read Relay's `@relayprotocol/relay-svm-wallet-adapter` source and the live `/quote/v2` response for an EVM→SVM route. Build against the actual shape, not a guess. |
| 2 | RPC rate limits on the public fallback endpoints will bite under traffic. | We already use Alchemy/Helius keys via `resolveRpcUrls`. Ship with both keys set; document them as required env vars for prod. |
| 3 | `RELAY_APP_FEE_BPS = 50` is a working assumption. `UNIVERSAL_FEES.ALL = 0.5` could mean 0.5% (= 50 bps) or 0.5 bps — ambiguous. | Confirm with product before Phase 1 PR. The constant is config-driven so changing it is one line. |
| 4 | Fee threshold of $0.025 means tiny swaps won't actually pay us. | Acceptable for v1. Surface a warning in `QuoteSummary` if the quoted app-fee USD amount is below the floor. |
| 5 | The current `chain-selector.tsx` includes Polygon as "Coming Soon." Removing it changes the UI. | Confirmed scope is ETH/Base/Solana only; we can re-add Polygon (chainId 137 already in `RELAY_CHAIN_INFO`) in a follow-up plan with one config-line entry. |
| 6 | Same-chain swaps. The UI will let the user pick `from=base, to=base`. | For v1, **disable the swap button** when `fromChain === toChain && fromToken === toToken` (no-op), but **allow same-chain different-token quotes** by routing them through Relay anyway. `SWAP_PROVIDER_OPTIONS` in config hints we may eventually prefer 0x/Jupiter for same-chain — out of scope here. |
| 7 | Wallet-on-wrong-network UX. EVM wallet is on Ethereum but user picks Base as origin. | RainbowKit prompts a chain switch when we call a tx on a chain the wallet isn't on. We'll surface this in the button state ("Switch to Base"). |
| 8 | `recipient` defaulting. If user has Phantom connected but origin is EVM and destination is Solana, the destination recipient should be the Phantom address. | `BridgeCard` reads `recipient` from `useActiveWallet().byVm(toChain.vmType)`. If that wallet isn't connected, swap button shows "Connect Solana wallet." |
| 9 | The hosted Vercel blob image URLs in `bridge-card.tsx` and `page.tsx` are external dependencies. | Not changed by this plan, but noting: long-term these should move to `public/`. Tracked as a separate cleanup. |
| 10 | `next.config.mjs` has `typescript.ignoreBuildErrors: true`. We'll be adding a lot of types. | Turn off `ignoreBuildErrors` after Phase 1 so subsequent PRs surface type regressions in CI. |

---

## 12. Definition of done

- A connected user can pick **any** supported token on **any** of {Ethereum, Base, Solana}, choose an output token on **any** of those three chains, see a Relay quote within 1 s, click swap, sign in their wallet, and watch the status modal progress from "Submitting" through "Complete" with a working destination explorer link.
- App fees show up in `/requests/v2[].paidAppFees` for the test swaps.
- Mobile (≤ 640 px), tablet, and desktop layouts all look correct (per `CLAUDE.md` rule #2).
- All endpoints, chain ids, token addresses, bps values, and feature flags are in `config/*.ts` (per `CLAUDE.md` rule #1). Code search for any hex address or `https://api.relay` outside `config/` and `lib/relay/` returns nothing.
- TypeScript compiles cleanly with `ignoreBuildErrors` flipped back to `false`.

---

## 13. Reference reading order (for the implementer)

1. `docs/external_docs/Relay Docs/Quickstart - Relay.pdf` — the 5-step model.
2. `docs/external_docs/Relay Docs/Get Quote - Relay.pdf` — full request/response schema.
3. `docs/external_docs/Relay Docs/Get Status - Relay.pdf` — status enum + polling.
4. `docs/external_docs/Relay Docs/Chain Support Guides/Solana Support - Relay.pdf` — SVM specifics (case-sensitive addrs, custom chain id, custom calldata).
5. `docs/external_docs/Relay Docs/Taking Transaction Fees/App Fees.pdf` — appFees shape, claim flow, verification.
6. `docs/external_docs/Relay Docs/Taking Transaction Fees/Swaps.pdf` — confirms Relay handles bridge + swap with one quote.
7. `config/blockchain_config.ts`, `config/chain_info.ts`, `config/fees_config.ts`, `config/token_info/*` — what's already in place.
