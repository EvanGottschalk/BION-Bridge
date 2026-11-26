# Faucet

The testnet faucet page at `/faucet` (`app/faucet/page.tsx`). All literals
live in `config/faucet_config.ts`. The header nav links to it via `NAV_LINKS`
in `config/ui_config.ts` (`FAUCET_ROUTE`).

## 1. Layout

```
CyberForestBackground   components/faucet/cyber-forest-background.tsx
BridgeHeader            (shared)
<main>
  Heading + subheading
  FaucetCard            components/faucet/faucet-card.tsx
    ├─ FaucetScene      components/faucet/faucet-scene.tsx   (SVG faucet + wallet)
    ├─ DorothyDialogue  components/faucet/dorothy-dialogue.tsx
    └─ Token select + Claim button
  BridgeFooter          (shared)
```

- **Mobile / md:** one column: scene, then Dorothy, then controls. At `md` the
  select and button sit side by side.
- **lg+:** two columns: scene on the left, Dorothy + controls on the right.
- The token-select box's transparency is set per element in
  `FAUCET_CONTROLS_OPACITY` (0–1), applied to the hex colors in
  `FAUCET_CONTROLS_COLORS` via `withOpacity` (`lib/faucet/color.ts`). Blur
  behind each element is in `FAUCET_CONTROLS_BLUR_PX`.
- The scene SVG is capped at `52vh` (`68vh` on lg) so the controls stay near
  the fold.

## 2. Cyber forest background

A fixed, full-viewport SVG of circuit-trace "trees" (two depth layers),
pulsing nodes and drifting data motes. It is generated procedurally from
`FAUCET_FOREST.seed` with a deterministic PRNG, so the server and client render
identical markup (no hydration mismatch). Change the seed or counts in config
to reshuffle it.

## 3. Dorothy (NPC dialogue)

Dorothy is not animated. She appears as a video-game NPC portrait
(`src/image/Dorothy.png`, cropped via `DOROTHY.portraitFocus` /
`portraitZoom`) beside a dialogue box. Her lines (`DOROTHY_LINES`) type out at
`FAUCET_TYPEWRITER_MS_PER_CHAR`. Clicking the box reveals the whole line. The
portrait frame pulses while she is "speaking". Screen readers get the full line
once via an `aria-live` sr-only span, not character by character.

She speaks at every step: greeting → token chosen / needs wallet → turning →
dropping → success (or failure / cooldown).

## 4. Claim flow and animation

`FaucetCard` drives a `phase` that `FaucetScene` exposes as `data-phase` on
the SVG. All motion is CSS in `app/globals.css` under the "Faucet" section,
keyed off `data-phase`:

| phase      | what happens                                                       | duration |
|------------|--------------------------------------------------------------------|----------|
| `idle`     | nozzle lip pulses, a tiny drip falls now and then                   | —        |
| `turning`  | valve wheel spins −300°, energy dashes flow through the pipe        | `FAUCET_TIMING_MS.turning` |
| `charging` | a big blue-green drop swells at the nozzle (also waits for the claim)| `.charging` |
| `falling`  | drop accelerates down into the wallet slot                          | `.falling` |
| `splash`   | wallet squash-and-stretch, ripples, particles, `+amount SYMBOL`     | `.splash` |
| `done`     | valve closes, wallet stays full of energy (see "Filled wallet")     | —        |

Timings are passed into CSS as `--faucet-*` custom properties from config, so
changing `FAUCET_TIMING_MS` keeps JS sequencing and CSS durations in sync.
Colors are SVG attributes / inline styles from `FAUCET_COLORS`; the CSS only
moves things.

With `prefers-reduced-motion`, scene animations are disabled, the JS phases
take 0 ms, and Dorothy's text appears instantly.

## 5. Wallet requirement

The selected token's VM (`evm` / `svm`) decides which wallet is needed. If it
isn't connected, the button reads "Connect EVM/Solana wallet" and opens
RainbowKit's or the Solana adapter's modal.

## 6. Real claims (server)

Tokens: tBION and SOL on Solana Devnet, ETH on Base Sepolia (`FAUCET_TOKENS`).
Each address can claim **each token once per `FAUCET_COOLDOWN_SECONDS`** (24h).

```
FaucetCard → lib/faucet/claim.ts (requestFaucetClaim)
  → POST /api/faucet/claim  { tokenId, recipient }   app/api/faucet/claim/route.ts
       1. validate token id (amount comes from config, never the request) + address
       2. reserve the cooldown: Redis SET faucet:v1:{tokenId}:{address} NX EX 86400
          → already set? 429 { code: 'cooldown', retryAfterSeconds }
       3. send from the faucet wallet       lib/faucet/server/evm.ts | solana.ts
       4. send failed (nothing left the wallet)? DEL the key so they can retry
  ← { ok, amount, symbol, txHash, explorerUrl }
```

- **Server-only code** lives in `lib/faucet/server/` (each file imports
  `server-only`, so it can never be bundled into the browser).
- **Secrets** (`.env.local` locally, Vercel → Settings → Environment Variables
  in production): `FAUCET_EVM_PRIVATE_KEY`, `FAUCET_SOLANA_SECRET_KEY`, and the
  Upstash Redis pair (`KV_REST_API_URL`/`_TOKEN` or
  `UPSTASH_REDIS_REST_URL`/`_TOKEN`). Names are in `FAUCET_ENV`.
- **No Redis in local dev** → an in-memory store is used (resets on restart).
  In production the route returns `not_configured` instead.
- **RPC:** Base Sepolia uses `BASE_SEPOLIA.rpcUrls` (Alchemy, then public);
  Solana uses Helius devnet if `NEXT_PUBLIC_HELIUS_API_KEY` is set, else the
  public devnet RPC (`FAUCET_SOLANA_RPC_URLS`).
- **SPL tokens:** the mint's owner decides the program (tBION is Token-2022).
  The faucet pays the ~0.002 SOL rent to create a recipient's token account
  the first time.
- **Confirmation:** the route waits up to `FAUCET_CONFIRM_TIMEOUT_MS` for the
  tx to confirm, then replies anyway (the cooldown stays). Route `maxDuration`
  is 60 s.
- **Errors** (`FAUCET_ERRORS`) are read out by Dorothy: `cooldown` uses
  `DOROTHY_LINES.cooldown` ("refills for you in 5h 12m"); others use
  `DOROTHY_LINES.failure`. A send failing for lack of funds reports `dry`.
- After a claim, a "View transaction" link to the explorer appears under the
  controls.
- **Wallet label** ("0.023 ETH"): the connected wallet's balance is read
  on-chain once per token / wallet (`lib/faucet/balance.ts`). After a claim
  it is *not* re-read; the claimed amount is added locally and counts up over
  `FAUCET_TIMING_MS.balanceCountUp` when the drop lands. Shows "—" when no
  wallet is connected. Long labels shrink to fit.
- **Filled wallet:** when a claim lands, the wallet fills up to just above its
  dotted line (halfway to the bottom of "MY WALLET"; `WALLET_FILL_TOP` in
  `faucet-scene.tsx`, clipped to the wallet body's exact shape) and stays
  filled (`data-filled` on the scene SVG) while the selected token is on
  cooldown for the connected wallet. The card asks
  `GET /api/faucet/claim?tokenId=…&recipient=…` (→ `{ cooldownSeconds }`, the
  Redis TTL) whenever the token / wallet changes, so it survives reloads and
  turns off by itself when the cooldown ends. Strength: `FAUCET_WALLET_FILL`.
- **Liquid surface** (`FAUCET_WALLET_SURFACE.style`): `'waves'` (two layers of
  drifting waves; the liquid is one SVG path built by `liquidPath`),
  `'ripples'` (flat surface with rings spreading across it, shown once the
  energy settles), or `'flat'`.
- `FAUCET_DEFAULT_TOKEN_ID` (tBION) is selected on load, so a token is always
  chosen.
- **Not protected against:** one person using many addresses. Fine for a demo;
  add a per-IP limit or a captcha if it gets abused.

## 7. Known quirk

Radix `Select` generates ids that differ between server and client under the
wallet provider tree, which caused a hydration warning. `FaucetCard` therefore
renders a look-alike placeholder until hydration, then the real `Select`.
