# Faucet

The testnet faucet page at `/faucet/v1` (`app/faucet/v1/page.tsx`). Versioned
in the URL so alternative designs can live at `/faucet/v2`, etc. side by side.
All literals live in `config/faucet_config.ts`. The header nav links to it via
`NAV_LINKS` in `config/ui_config.ts` (`FAUCET_V1_ROUTE`).

## 1. Layout

```
CyberForestBackground   components/faucet/v1/cyber-forest-background.tsx
BridgeHeader            (shared)
<main>
  Heading + subheading
  FaucetCard            components/faucet/v1/faucet-card.tsx
    ├─ FaucetScene      components/faucet/v1/faucet-scene.tsx   (SVG faucet + wallet)
    ├─ DorothyDialogue  components/faucet/v1/dorothy-dialogue.tsx
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
dropping → success (or failure).

## 4. Claim flow and animation

`FaucetCard` drives a `phase` that `FaucetScene` exposes as `data-phase` on
the SVG. All motion is CSS in `app/globals.css` under the "Faucet v1" section,
keyed off `data-phase`:

| phase      | what happens                                                       | duration |
|------------|--------------------------------------------------------------------|----------|
| `idle`     | nozzle lip pulses, a tiny drip falls now and then                   | —        |
| `turning`  | valve wheel spins −300°, energy dashes flow through the pipe        | `FAUCET_TIMING_MS.turning` |
| `charging` | a big blue-green drop swells at the nozzle (also waits for the claim)| `.charging` |
| `falling`  | drop accelerates down into the wallet slot                          | `.falling` |
| `splash`   | wallet squash-and-stretch, ripples, particles, `+amount SYMBOL`     | `.splash` |
| `done`     | valve closes, wallet keeps a soft energy glow                       | —        |

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

## 6. The claim is simulated

`lib/faucet/claim.ts` → `requestFaucetClaim(token, recipient)` currently just
waits `FAUCET_SIMULATED_CLAIM_MS` and resolves. **No tokens are actually
sent.** Wire a real faucet (API route or on-chain call) there. Thrown errors
are surfaced through Dorothy's `failure` line.

## 7. Known quirk

Radix `Select` generates ids that differ between server and client under the
wallet provider tree, which caused a hydration warning. `FaucetCard` therefore
renders a look-alike placeholder until hydration, then the real `Select`.
