# Bridge UI

The frontend the user sees and interacts with: the page layout, the bridge card,
the chain and token pickers, the live quote, and the swap-progress modal. This
file documents what is on screen, how the pieces are wired together, and where
each literal value lives. Companion docs:

- `Connecting Web Wallets.md` — how wallet connection works.
- `Cross-chain Swaps and Bridging.md` — what happens after the user clicks Swap.

## 1. Page shell

The whole site is a single Next.js app-router page at `app/page.tsx`, plus two
legal sub-pages at `app/terms/page.tsx` and `app/privacy/page.tsx`. The shell is
identical on all of them:

```
GridBackground         components/bridge/grid-background.tsx
BridgeHeader           components/bridge/header.tsx
  └─ ConnectButton     components/bridge/connect-button.tsx
<main>
  ...page-specific content...
  BridgeFooter         components/bridge/footer.tsx
</main>
```

- **GridBackground** is a fixed, full-viewport decorative layer (faint grid +
  radial glows + a scanning line). Pointer events are disabled.
- **BridgeHeader** is right-aligned on all viewports. It renders the connect
  pills and, on `md+` viewports, the nav links from `NAV_LINKS`
  (`config/ui_config.ts`).
- **BridgeFooter** renders "Powered by Aphid · BION Token · BION DAO" plus the
  legal links. Internal hrefs (e.g. `/terms`) use `next/link`; external hrefs
  use `<a target="_blank">`.

The home page (`app/page.tsx`) adds a hero (logo + tagline from
`BRIDGE_HERO_COPY`), the `BridgeCard`, and the `StatsBar`. The legal pages
substitute a long-form `LegalPage` shell — same background, header, and footer,
but with a centred article column.

## 2. The bridge card

`components/bridge/bridge-card.tsx` is the heart of the UI. It owns the entire
form state and orchestrates quoting and execution.

### 2.1 Layout

Two side-by-side panels with an arrow between them. On mobile the panels stack
vertically and the arrow rotates 90° — see the `rotate-90 md:rotate-0` class on
the swap-sides button (`bridge-card.tsx:237`).

```
[ From panel ]   ⇄   [ To panel ]
  ChainSelector        ChainSelector
  TokenSelector        TokenSelector
  Amount input         "You receive" (read-only)
                QuoteSummary
                [ primary action button ]
```

### 2.2 State

All form state is local React state inside `BridgeCard`:

| field        | type                  | source of truth                       |
|--------------|-----------------------|---------------------------------------|
| `fromChain`  | `ActiveChainKey`      | `useState`, default `'solana'`        |
| `toChain`    | `ActiveChainKey`      | `useState`, default `'base'`          |
| `fromToken`  | `TokenInfo \| null`   | `getNativeToken(fromChain)`           |
| `toToken`    | `TokenInfo \| null`   | `getNativeToken(toChain)`             |
| `amount`     | `string` (decimal)    | user input, validated by a regex      |
| `progress`   | `SwapProgressUiState` | drives the progress modal             |
| `progressOpen` | `boolean`           | shows/hides the progress modal        |

The amount input accepts only `^\d*(?:\.\d*)?$` and rewrites commas to dots so
European decimal input still works (`bridge-card.tsx:218`).

### 2.3 Three handlers worth knowing

- **`onChainFromChange` / `onChainToChange`** — if the new chain equals the
  other side's chain, they automatically swap rather than letting the user pick
  the same chain on both sides. They also reset the token to that chain's
  native token, because a token from the old chain is meaningless on the new
  one.
- **`swapSides`** — flips both chains and both tokens at once. This is the only
  way to keep the *same token* on both sides (useful for a pure bridge of, say,
  USDC).
- **`handleSwap`** — see "swap execution" below.

### 2.4 The primary action button

The button label and behaviour are derived in a single `useMemo` at
`bridge-card.tsx:74`. Priority order, top-down:

1. Origin wallet not connected → "Connect EVM/Solana wallet" (the user actually
   clicks the connect pill in the header; this is just a visual cue).
2. Destination chain is a different VM type than the origin chain and the
   destination wallet isn't connected → "Connect EVM/Solana wallet".
   (Same-VM cross-chain swaps reuse the same wallet for both ends, so this
   check only fires when crossing the EVM↔SVM boundary.)
3. No token selected → disabled "Select tokens".
4. No / zero amount → disabled "Enter amount".
5. Quote is loading / errored / not yet ready → disabled with a corresponding
   label.
6. All systems go → enabled "Swap FROM → TO".

While the swap is mid-flight (`isBridging`) the button is disabled and shows a
spinner.

## 3. Selectors

### 3.1 ChainSelector

`components/bridge/chain-selector.tsx` is a dropdown driven entirely by
`ACTIVE_CHAINS` from `config/active_chains.ts`. To add or remove a chain from
the UI, edit that array — nothing in this component needs to change.

The icons come from `components/bridge/chain-icons.tsx`, which hard-codes SVG
markup for Ethereum, Base, and Solana. They are picked by `iconKey`, so a new
chain needs both an `ActiveChain` entry and a corresponding icon.

The selected-chain match is `find ... ?? ACTIVE_CHAINS[0]` so an unknown key
falls back to the first chain instead of crashing.

### 3.2 TokenSelector

`components/bridge/token-selector.tsx` is more involved. Per chain it shows:

1. **Featured tokens** — `FEATURED_TOKENS_BY_CHAIN` in
   `config/token_info/index.ts`. These are the curated top-6 (ETH/USDC/USDT/…)
   that appear without scrolling and without a search query.
2. **All local tokens** — every token defined under `config/token_info/*` for
   that chain, filtered against the search query (symbol, name, or exact
   address match).
3. **Remote results from Relay** — when the query is ≥ 2 characters, debounced
   by `RELAY_TOKEN_SEARCH_DEBOUNCE_MS` (250 ms), we hit
   `relayApi.searchCurrencies` (`POST /currencies/v2`) with
   `useExternalSearch: true` and `limit: RELAY_TOKEN_SEARCH_LIMIT` (20). Any
   result whose address already exists locally is filtered out so we don't
   render duplicates.

Each row uses `useTokenBalance` (see §5) to show the connected wallet's balance
on the right. The "balance" column shows `…` while loading, the formatted
amount when known, or `—` when no wallet is connected for that chain.

The button face is a custom dropdown rather than a native `<select>` because it
needs to render the token icon + symbol + name. Click-outside-to-close is
implemented manually via a `mousedown` listener bound to `document`.

### 3.3 TokenIcon

`components/bridge/token-icon.tsx` tries icon sources in order and falls back
to the next one on `<img onError>`:

1. **Local** — a Next.js route handler at `app/token-icon/[symbol]/`, served
   from bundled assets under `src/image`. URL built by `TOKEN_ICON_URL` in
   `config/ui_config.ts`.
2. **logo.dev** — only if `NEXT_PUBLIC_LOGO_DEV_API_KEY` is set. Built by
   `TOKEN_ICON_LOGO_DEV_URL`, returns WEBP at 128px retina.
3. **Remote `logoURI`** — what Relay returned for that token.
4. **Placeholder** — a circular badge showing the first three letters of the
   symbol.

The `useEffect` resetting `tierIndex` is important: switching tokens must reset
the fallback chain or you'll get the previous token's placeholder.

## 4. Quote display

`components/bridge/quote-summary.tsx` renders three pieces:

1. A header strip with app-fee percentage (derived from `RELAY_APP_FEE_BPS` in
   `config/relay_config.ts` — 50 bps = 0.5%), ETA from
   `details.timeEstimate`, and "Secured by Relay".
2. A loading / error / fetching banner depending on `QuoteState.kind`.
3. A two-column key/value grid: rate, output USD value, gas, relayer fee, app
   fee, price impact, slippage. Every row is conditionally rendered — if Relay
   didn't return that field, the row is skipped rather than rendering "—".

The card preserves the *previous* quote during refetches so the user doesn't
see the output amount snap back to `0` every 20 s when the quote auto-refreshes
(`use-relay-quote.ts:56`). See `Cross-chain Swaps and Bridging.md` for the
quote lifecycle.

## 5. Token balances

`hooks/use-token-balance.ts` is a single hook that abstracts EVM vs Solana
balance fetching:

- **EVM** — delegates to wagmi's `useBalance`. Native ETH passes `token:
  undefined` and lets wagmi read the native balance; ERC-20s pass the token
  address. Cached for 15 s.
- **Solana** — manual. Native SOL uses `connection.getBalance` (returns
  lamports). SPL tokens use `getParsedTokenAccountsByOwner` and sum across all
  associated token accounts for that mint (a user can have more than one ATA
  per mint, e.g. via 2022 / non-2022 token programs). On error we set the
  balance to `0n` rather than `null` to avoid the UI permanently showing `…`.

`formatTokenAmount` (exported from the same file) is a precision-safe BigInt
formatter used by both the selector rows and the wallet account modal.

## 6. Swap execution UI

The handler is `handleSwap` (`bridge-card.tsx:112`). It:

1. Opens the progress modal in `executing` state with the copy "Confirm the
   transactions in your wallet."
2. Calls `executeSteps` (from `lib/relay/execute.ts`) with the quote's steps,
   both signers, and an `onProgress` callback that updates the modal copy as
   each transaction is broadcast.
3. After execution returns a `requestId`, calls `pollStatus` (from
   `lib/relay/status.ts`). The poller invokes `onUpdate` once per second; we
   forward those into the `polling` UI state.
4. Maps the terminal `RelayStatus` onto one of `success`, `refunded`, or
   `failure` UI states.

The implementation details of the execution and polling layer belong in
`Cross-chain Swaps and Bridging.md` — this file just documents the UI surface.

### 6.1 SwapProgress modal

`components/bridge/swap-progress.tsx` is a portal-style overlay (fixed,
`z-[100]`, click-outside to close) that renders five elements:

- A status icon — checkmark on success, X on failure or refund, spinner during
  the in-flight states.
- Title + body, looked up in `STATUS_COPY` (`config/ui_config.ts`) keyed by the
  `RelayStatus`. The title for in-flight steps comes from the `executing`
  label set by `BridgeCard` (e.g. "Transaction broadcast. Waiting for solver…").
- A four-segment progress bar driven by `STAGE_ORDER = ['waiting', 'pending',
  'submitted', 'success']`. Each segment fills when its stage is reached.
- Explorer links for `inTxHashes[0]` (origin) and `txHashes[0]` (destination),
  built via `buildExplorerTxUrl` in `config/active_chains.ts`.
- A "Done" button on terminal states.

Closing the modal mid-flight only hides it — execution continues in the
background; the `BridgeCard` button is locked while `isBridging` is true.
Closing in a terminal state resets the `progress` state back to `awaiting`.

## 7. Stats bar

`components/bridge/stats-bar.tsx` is currently a feature-flagged placeholder.
Each stat in `STATS_DISPLAY` (`config/ui_config.ts`) has a `displayMode` of
either `'hidden'` or `'string'`. Hidden stats are filtered out; if all three
are hidden, the component renders `null` (no empty container). When the real
indexer-backed feed lands, add a `'live'` display mode and a number source.

## 8. Wallet account modal

`components/bridge/wallet-account-modal.tsx` is the modal that opens when the
user clicks a connected pill. It shows the truncated address, the native
balance on that chain (via `useTokenBalance`), a "Copy Address" button with a
~1.6 s feedback animation (`WALLET_COPY_FEEDBACK_MS`), and a "Disconnect"
button. The connect-pill components in `connect-button.tsx` own this modal's
state — see `Connecting Web Wallets.md` for how it integrates with RainbowKit
and the Solana wallet adapter.

## 9. Config paradigm (mandatory)

Per `CLAUDE.md` rule #1, every literal in this UI lives in `config/*.ts`:

- Copy, labels, brand colours, theme: `config/ui_config.ts`.
- Legal page copy: `config/legal_config.ts`.
- Active chain set, RPC URLs, explorer URLs, native token decimals:
  `config/active_chains.ts` + `config/chain_info.ts`.
- Token lists: `config/token_info/*`.
- Relay API endpoints, debounce/refresh timings, app-fee bps:
  `config/relay_config.ts`.
- Fee recipient address, fee priority table: `config/fees_config.ts`.

When adding a new screen or component, never inline a string, hex colour, URL,
or numeric threshold — add it to the appropriate config file and import it.

## 10. Responsive breakpoints

Mobile-first Tailwind. Breakpoints actually used in the UI:

- **No prefix** = mobile baseline. Bridge panels stack, header drops nav links.
- **`sm`** (640px+) — connect-pill labels become visible ("Connect EVM" vs
  just an icon).
- **`md`** (768px+) — bridge panels become side-by-side, swap arrow rotates to
  horizontal, header nav links appear.

There is no desktop-only fork of any component; everything scales from a single
mobile layout up.
