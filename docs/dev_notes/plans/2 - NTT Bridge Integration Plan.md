# 2 — NTT Bridge Integration Plan

> Status: **Draft — lead decisions recorded 2026-10-18 (see §10)**
> Scope: Let the bridge card route selected tokens through a **Wormhole Native Token Transfers (NTT)** deployment instead of Relay. The first token is **BRDGTST** (Solana Devnet ⇄ Base Sepolia). The design must make it easy to add more NTT tokens, including ones that use different NTT deployments, by editing config only.
> Researched: 2026-10-18 (NTT SDK `8.0.1`, Wormhole SDK `6.1.5`).

---

## 1. Goals & Non-Goals

### Goals
1. When the user selects a token that is listed in `NTT_BRIDGE_INFO`, the bridge card quotes, executes, and tracks the transfer through that token's NTT deployment. Every other token keeps using Relay.
2. Make bridging providers pluggable. Relay and NTT both implement one `BridgeProvider` interface, and a router picks one for each (chain, token) pair.
3. Make NTT deployments config-only. Adding a token means one entry in `NTT_BRIDGE_INFO` plus a token entry in `config/token_info/*`.
4. Support BRDGTST in both directions: Solana Devnet → Base Sepolia, and Base Sepolia → Solana Devnet.
5. Follow `CLAUDE.md`: all literal values live in config, the layout is mobile-first, and nothing is edited via bash.

### Non-Goals (deferred)
- Swapping into or out of an NTT token, e.g. SOL → BRDGTST. NTT only moves the same token between chains. A later plan could chain "Relay swap → NTT bridge".
- Multi-token NTT (`MultiTokenNttRoute`). It is a different contract family.
- Admin tooling for NTT itself (rate limits, peers, pausing). That stays in the `ntt` CLI.
- Claim/withdraw UI for referrer fees.
- Destination native-gas drop-off (the Executor's `GasDropOffInstruction`). The lead rejected it as too confusing, so NTT transfers send only the token.

---

## 2. How Wormhole NTT works (research summary)

### 2.1 Components
| Piece | What it does |
|---|---|
| **Token** | An ERC-20 or SPL/Token-2022 mint that you own. NTT does not wrap it. The same token exists natively on every chain. |
| **NttManager** | One per chain. It holds config (mode, peers, rate limits) and does the token accounting. It **locks** tokens (hub mode) or **burns/mints** them (spoke/burning mode). |
| **Transceiver** | Sends and receives the cross-chain message. We only use the **Wormhole transceiver**: the Guardian network signs a VAA attesting that the source-chain message happened. On Solana the transceiver is built into the manager program. On EVM it is a separate contract. |
| **Peers** | Each manager registers its counterpart managers and transceivers on other chains by Wormhole chain ID. A transfer is only accepted from a registered peer. |
| **Rate limits** | Each manager has an outbound limit and a per-source-chain inbound limit. These are 24 h rolling capacities. If a transfer exceeds capacity, it is reverted (`shouldQueue=false`) or queued for 24 h (`shouldQueue=true`). |
| **Decimal trimming** | Amounts on the wire are trimmed to `min(8, tokenDecimals)`. A token with 9 decimals can only move with 8 decimals of precision, and any 9th-decimal dust stays with the sender. |

### 2.2 Lifecycle of one transfer
```
[source] user calls NttManager.transfer → burn (spoke) or lock (hub)
         → transceiver publishes a Wormhole message
[guardians] wait for source finality → sign VAA
[relay]  Executor relayer submits the VAA to the destination transceiver (or the user redeems manually)
[dest]   NttManager checks the peer and inbound limit → mint (spoke) or unlock (hub)
```

### 2.3 Relaying: use the **Executor**, not the Standard Relayer
- The Wormhole Standard Relayer was **shut down on 2026-04-01**. Automatic delivery for NTT now goes through the **Executor** framework.
- On the source chain, the user pays the Executor's quoted fee in native gas, together with the transfer:
  - **EVM:** call `NttManagerWithExecutor.transfer(nttManager, amount, recipientChain, recipientAddress, refundAddress, shouldQueue, encodedInstructions, ExecutorArgs{value, refundAddress, signedQuote, instructions}, FeeArgs{dbps, payee})`.
  - **Solana:** call `ntt.transfer(...)`, then append the `relay_ntt_message` instruction from the `example-ntt-with-executor` program in the same v0 transaction.
- Executor API (testnet): `https://executor-testnet.labsapis.com`, with `GET /v0/capabilities`, `POST /v0/quote`, and `POST /v0/status/tx`.
- `FeeArgs` plus a `payee` let **us take a referrer fee** on NTT transfers. The docs describe `dbps`; SDK 8.0.1 actually sends an absolute `transferTokenFee` (see the §7 correction). This replaces Relay app fees on NTT routes (see §7).
- If the Executor fails, the user can still redeem **manually** on the destination chain. The SDK exposes `route.complete(signer, receipt)` for this.

### 2.4 The TypeScript SDK path
The official packages handle every hard part of the Solana side: the outbox keypair, address lookup tables, the executor instruction, and the post-message shim. They are:

```
@wormhole-foundation/sdk-connect      6.1.5   Wormhole context, routes, Signer interface
@wormhole-foundation/sdk-evm          6.1.5   EVM platform
@wormhole-foundation/sdk-solana       6.1.5   Solana platform
@wormhole-foundation/sdk-route-ntt    8.0.1   nttExecutorRoute(), nttManualRoute()
@wormhole-foundation/sdk-evm-ntt      8.0.1   EVM NTT protocol + NttManagerWithExecutor addresses
@wormhole-foundation/sdk-solana-ntt   8.0.1   Solana NTT protocol + executor program ids
@wormhole-foundation/sdk-definitions-ntt 8.0.1
```

`nttExecutorRoute({ ntt: { tokens: { BRDGTST: [TokenConfig, TokenConfig] } }, getFee })` returns a route class with `validate → quote → initiate → track → complete`. `TokenConfig = { chain, token, manager, transceiver: [{ type: 'wormhole', address }] }`. Our config already has every one of these fields.

---

## 3. Verified on-chain state of BRDGTST (2026-10-18)

| | Solana Devnet (hub) | Base Sepolia (spoke) |
|---|---|---|
| Token | `3KEy4DGbNEnMX67QNHHp3sDyXBDy9QzAnbUks8n2wxRL` (**Token-2022**) | `0x27f73ff4f073B4Bf98f910B52F522eDc4778eDaA` |
| Decimals | 9 | 9 |
| On-chain name / symbol | "Bridge Test 48" / BRDGTST | "Bridge Test 48" / BRDGTST |
| Supply | 500 BRDGTST | 0 (nothing bridged yet) |
| NTT manager | `BRdDtfZ1obCVAwnXA3MNfFf5NR4zEoJKutqCyKjJWw7N` | `0x52F00C4A1f38979dB0B729AAb4Ea0a203A499A3B` (v2.0.0) |
| Transceiver | same program as the manager | `0xF20e4e381E14405E1eB9DdD80cbEF9e4bf0ecFe8` |
| Mode | **locking** (custody `8HCmwLzh…mg7E`) | **burning** |
| Wormhole chain id | 1 | 10004 |
| Peer registered | ✅ peer for 10004 exists | ✅ peer for 1 = `BRdDtf…` (9 decimals) |
| Threshold / paused | 1-of-1 / not paused | 1-of-1 / not paused |
| Rate limits | — | outbound capacity **100 BRDGTST**, inbound from Solana **1000 BRDGTST** |
| Lookup table | NTT-native LUT exists ✅ | n/a |

Executor infrastructure, verified:
- Executor testnet capabilities include chains `1` and `10004`, with relay type `ERN1` (NTT).
- `NttManagerWithExecutor` on Base Sepolia (`0x9fBC8aA6B2f626D13005De92B3f0e4541919f721`) is deployed.
- The Solana programs `nex1gkSW…` (ntt-with-executor), `execXUrA…` (executor), and `1uteB5DZ…` (LUT helper) are deployed on devnet.

**Conclusion:** the deployment is wired correctly. Test Solana → Base first, because all supply currently sits on Solana.

---

## 4. The biggest prerequisite: testnet support via an in-app "Test Mode" toggle

The app is **mainnet-only** today. `ACTIVE_CHAINS` has only `ethereum | base | solana` (all mainnet), wagmi is configured for `[mainnet, base]`, and the Solana `ConnectionProvider` points at mainnet. BRDGTST lives on **Solana Devnet and Base Sepolia**, so it cannot appear in the UI until the app can target testnets.

**Decision (lead, 2026-10-18): an in-app "Test Mode" toggle whose label reads `ON` or `OFF`.**

### 4.1 State
- `lib/network/network-mode.tsx` provides a `NetworkModeProvider` context and a `useNetworkMode()` hook that returns `{ testMode: boolean, setTestMode }`. The provider is mounted in `lib/wallets/provider.tsx`, above the Solana `ConnectionProvider`, because the Solana endpoint depends on it.
- The default comes from `TEST_MODE_DEFAULT = false` in `config/blockchain_config.ts`.
- The user's last choice is remembered in `localStorage` (key in config). Every read and write is wrapped in try/catch, so a blocked or empty store just falls back to the default.
- **The toggle ships on the production site.** Whether it appears at all is controlled by `TEST_MODE_TOGGLE_VISIBLE = true` in `config/ui_config.ts`. Setting it to `false` hides the toggle, and the app then always runs with Test Mode OFF, ignoring any stored choice. That way a hidden toggle can't leave a user stuck on testnet.

### 4.2 Chains per mode
- Add `ACTIVE_CHAINS_BY_MODE` to `config/active_chains.ts`:
  - `mainnet`: ethereum, base, solana (unchanged).
  - `testnet`: sepolia, base-sepolia, solana-devnet. These wrap the existing `ETH_SEPOLIA`, `BASE_SEPOLIA`, and `SOLANA_DEVNET` configs.
- Widen `ActiveChainKey` to include the testnet keys. Give each `ActiveChain` a `chainKey` (its `CHAINS.*` key, used to look up `NTT_BRIDGE_INFO.chains`), a `wormholeChain` (e.g. `'Solana'`, `'BaseSepolia'`), and `isTestnet`.
- Replace direct imports of `ACTIVE_CHAINS` with a `useActiveChains()` hook that returns the current mode's list. Affected components: `ChainSelector`, `BridgeCard` defaults, and the fallbacks in `TokenSelector` and the wallet modal.
- Add token maps for the testnet keys in `config/token_info/index.ts`, built from `eth_sepolia_testnet_tokens.ts`, `base_testnet_sepolia_tokens.ts`, and `solana_devnet_tokens.ts`. Also add native ETH/SOL entries and a featured list for each.

### 4.3 Wallets: switching without a full remount
- **EVM:** register **all four** EVM chains in `wagmiConfig` (mainnet, base, sepolia, baseSepolia), each with its own transport. The mode only filters which chains the UI offers, so wagmi and RainbowKit never remount. The existing `switchChain` step already moves the wallet onto the right network. The "Wrong network" pill compares against the *current mode's* EVM chains.
- **Solana:** `useSolanaEndpoint()` returns the devnet or mainnet RPC based on the mode, and `ConnectionProvider` receives it as its `endpoint`. Changing the endpoint swaps the `Connection` but keeps the wallet adapter connected. We broadcast through our own connection, so devnet transactions work even when Phantom's own UI is set to mainnet. Add a one-line hint in config copy telling users to enable Phantom's testnet mode so their devnet balances show up in the wallet.

### 4.4 Relay in Test Mode
**Decision: use Relay testnets.** When Test Mode is ON:
- `RELAY_API_BASE` switches to `RELAY_API_BASE_TESTNET = 'https://api.testnets.relay.link'`;
- the Relay chain ids come from the testnet chain entries: Sepolia `11155111`, Base Sepolia `84532`, and Solana Devnet **`901`** (lead decision, using the existing `SOLANA_DEVNET.chainId`);
- Relay's remote token search runs against testnet chains.
Coverage and liquidity on Relay testnets are thin, so quote failures there should surface as the normal "Quote failed" state, not as a crash.

### 4.5 The toggle UI
- **Placement:** in the bridge card header, replacing the static "Live" badge. The text "Test Mode" sits beside a switch whose label shows **`OFF`** or **`ON`**. It reuses the existing `components/ui/switch.tsx`.
- When Test Mode is ON, the old "Live" spot shows a "Testnet" badge with amber accent colours, defined in config.
- **Responsive:** on mobile the toggle sits on the same row as the "Bridge" title, as today's badge does, and it wraps under the title below `sm` if space is tight. On desktop it is unchanged.
- **Flipping the toggle:** reset the card state (both chains go to the new mode's defaults, both tokens go to native, the amount clears, and any quote is discarded). The toggle is **disabled while a transfer is in flight** (`isBridging`).
- All copy (`'Test Mode'`, `'ON'`, `'OFF'`, `'Testnet'`) goes in `config/ui_config.ts`.

---

## 5. Architecture

### 5.1 Provider abstraction
```
lib/bridge/
  types.ts          BridgeProvider, BridgeRoute, BridgeQuote, BridgeProgress (provider-neutral)
  router.ts         selectProvider(route) → 'ntt' | 'relay'
  providers/
    relay.ts        thin adapter over existing lib/relay/* (no behaviour change)
    ntt.ts          adapter over lib/ntt/*
lib/ntt/
  registry.ts       turns NTT_BRIDGE_INFO into lookups: findNttDeployment(chain, token), getPeerToken(...)
  wormhole.ts       lazy singleton Wormhole('Testnet'|'Mainnet', [evm, solana]) with our RPC overrides
  route.ts          builds nttExecutorRoute config from the registry (one entry per deployment)
  signers.ts        adapts our EvmSigner/SvmSigner to the Wormhole SDK SignAndSendSigner
  quote.ts          validate + quote → BridgeQuote
  execute.ts        initiate → receipt
  track.ts          route.track() → BridgeProgress, plus manual-redeem fallback
hooks/
  use-bridge-quote.ts   replaces direct use of useRelayQuote in BridgeCard; delegates by provider
```

```ts
interface BridgeProvider {
  id: 'relay' | 'ntt';
  supports(route: BridgeRoute): boolean;
  quote(route: BridgeRoute, signal: AbortSignal): Promise<BridgeQuote>;
  execute(quote: BridgeQuote, signers: Signers, onProgress: (p: BridgeProgress) => void): Promise<BridgeReceipt>;
  track(receipt: BridgeReceipt, onProgress: (p: BridgeProgress) => void): Promise<BridgeProgress /* terminal */>;
}
```

**Routing rule:** if `fromToken` and `toToken` both belong to the same `NTT_BRIDGE_INFO` deployment on their respective chains, use NTT. Otherwise use Relay. This logic lives only in `router.ts`.

`BridgeCard`, `QuoteSummary`, and `SwapProgress` consume only the neutral types. The Relay-specific `ParsedQuote` / `RelayStatus` usage moves behind the Relay adapter. This is the one real refactor of existing code.

### 5.2 Config shape for many deployments
**Decision: use a chain-keyed map. It is already applied in `config/blockchain_config.ts`.** An NTT deployment can span **N chains** (one hub plus several spokes), so each entry lists its chains by `ChainKey`:

```ts
BRDGTST: {
  network: 'Testnet',            // only offered while Test Mode is ON ('Mainnet' → only while OFF)
  chains: {
    SOLANA_DEVNET: { tokenContractAddress, NTTcontractAddress, NTTtransceiverAddress, mode: 'locking' },
    BASE_SEPOLIA:  { tokenContractAddress, NTTcontractAddress, NTTtransceiverAddress, mode: 'burning' },
  },
  gasLimitOverrides?: {...},     // optional per-deployment executor tuning (add when needed)
}
```

The registry (`lib/ntt/registry.ts`) derives every peer pair from `chains`. It filters deployments by `network` against the current Test Mode, so a testnet NTT token never appears in mainnet mode, and vice versa.

New file `config/ntt_config.ts` holds:
- `NTT_EXECUTOR_API` for each network.
- `CHAINKEY_TO_WORMHOLE_CHAIN` (`SOLANA_DEVNET → 'Solana'`, `BASE_SEPOLIA → 'BaseSepolia'`, `BASE_MAINNET → 'Base'`, …).
- Executor gas-limit defaults.
- `NTT_REFERRER_FEE_DBPS` and the referrer addresses for each chain (taken from `FEE_RECIPIENT_ADDRESSES`).
- Track poll interval and timeout.
- The Wormholescan URL builder.
- UI copy for NTT stages. Stage copy can go in `ui_config.ts` instead, next to `STATUS_COPY`.

### 5.3 Signer adapters (`lib/ntt/signers.ts`)
The Wormhole SDK expects `SignAndSendSigner { chain(), address(), signAndSend(txs: UnsignedTransaction[]) }`.
- **EVM:** each `UnsignedTransaction.transaction` is an ethers-style `TransactionRequest`. Map `to/data/value/gasLimit` → our `useEvmSigner().sendTransaction`, call `switchChain` first, and wait for a receipt before sending the next tx. The flow is approve → transfer.
- **Solana:** each tx is `{ transaction: VersionedTransaction | Transaction, signers?: Keypair[] }`. **We must `partialSign` / `sign([...signers])` with the SDK-provided ephemeral keypairs (the NTT outbox item) before handing the tx to the wallet's `signTransaction`.** The existing `useSvmSigner` only takes base64 or raw instructions, so this needs a new `signAndSendTx(tx, extraSigners)` method on it.
- Recipient: build `Wormhole.chainAddress(dstChain, destWallet.address)`. Cross-VM, the destination wallet must be connected, which the existing button logic already enforces.

### 5.4 Bundle size and loading
The SDK is heavy (it pulls in ethers v6 and anchor 0.29). **Load `lib/ntt/*` with dynamic `import()` only when the router picks NTT**, so Relay-only users never download it. Expect `next.config.mjs` to need `transpilePackages` for the `@wormhole-foundation/*` ESM packages. Do a spike first (Phase 0).

### 5.5 Alternative considered: hand-rolled calls (no SDK)
On EVM we could call `NttManagerWithExecutor.transfer` with viem and hit the Executor HTTP API ourselves. The Solana side (outbox keypair, LUT, executor instruction, shims, Token-2022 accounts) is far more fiddly, though. **Recommendation:** use the SDK for v1. The provider boundary means we can swap one side to hand-rolled code later if bundle size becomes a problem.

---

## 6. UI behaviour

1. **Token selector:** NTT tokens appear in the local list for their chains. Add a small "NTT" badge, with copy and colour in config.
2. **Pairing lock:** when an NTT token is picked on one side:
   - the other side auto-selects the **peer token** on the peer chain;
   - the chain selectors only offer chains in that deployment;
   - the destination token selector is locked, because NTT is same-token only.
   `swapSides` keeps working because both sides are in the same deployment. Picking a non-NTT token on either side releases the lock.
3. **Amount input:** cap precision at `min(8, decimals)` (BRDGTST: 8 decimals) so users never lose dust to trimming. Also check the input against:
   - the user's balance;
   - the source **outbound** capacity and destination **inbound** capacity, via `getCurrentOutboundCapacity` / `getCurrentInboundCapacity` or the route's warnings.
   Show "Exceeds bridge capacity (X available)" instead of letting the transfer revert.
4. **Quote summary:** "You receive" equals the trimmed amount minus our 0.5% fee (§7). Rows:
   - the Executor (relay) fee in native gas, plus USD if available;
   - our fee (0.5%, in BRDGTST);
   - ETA.
   Footer text: "Secured by Wormhole NTT". The Relay-specific rows are skipped, which already works because rows render conditionally.
5. **Primary button:** same priority list as today. Add "Exceeds bridge capacity" and "Insufficient gas for relay fee".
6. **Progress modal:** NTT stages map to the existing 4-segment bar:
   `SourceInitiated → Attested (VAA signed) → DestinationInitiated (executor submitted) → DestinationFinalized`.
   - Links: Wormholescan (`https://wormholescan.io/#/tx/<hash>?network=Testnet`) plus origin and destination explorers.
   - **ETA:** Solana → Base takes about a minute. Base → Solana waits for Base finality, typically **15–30 min**. The NTT track timeout must therefore be much longer than Relay's 10 min, and the modal should say clearly that the user can close it.
   - If the executor hasn't delivered after N minutes, show a **"Redeem manually"** button that runs `route.complete()` with the destination signer.
7. **Persistence:** these transfers can take tens of minutes, so persist `{provider, srcChain, txHash}` to `localStorage` and resume via `route.resume(txid)` on page load. This is a minimal version of the "recent bridges" feature flagged in plan 1. Treat it as Phase 4 if needed.
8. **Responsive:** no new layouts, only new rows, badges, and states inside existing components, using the existing breakpoints.

---

## 7. Fees

- Relay app fees (`RELAY_APP_FEE_BPS`, `RELAY_FEE_RECIPIENT`) do **not** apply to NTT.
- The Executor relay fee is paid by the user in source-chain native gas. It is real money and must appear in the quote.
- **Our fee on NTT (decision: 0.5%, the same as Relay):**
  - The executor route's `getFee` callback returns `transferTokenFee = amount × 0.5%` and the `referrerAddress` for the source chain.
  - **Correction (found while implementing):**
    - SDK `8.0.1` passes an **absolute** `transferTokenFee`, in token base units, to `FeeArgs{transferTokenFee, nativeTokenFee, payee}`. It does not use dbps.
    - The earlier "5000 dbps" figure was also wrong: 0.5% is 500 dbps, and 5000 dbps would be 5%.
  - The fee is derived from `UNIVERSAL_FEES.ALL`, not hard-coded: `NTT_REFERRER_FEE_BPS = UNIVERSAL_FEES.ALL * 100` (0.5 → 50 bps) in `config/ntt_config.ts`. The code computes `amount × 50 / 10_000`.
  - The payee is `FEE_RECIPIENT_ADDRESSES[sourceChainKey]` (`BASE_SEPOLIA` / `SOLANA_DEVNET` now, the mainnet keys later).
  - The fee is taken in the bridged token on the source chain, so the recipient gets `amount − fee`, trimmed to 8 decimals.
- **Solana path (confirmed from the SDK source):**
  - The SDK appends a Token-2022 `transferChecked` of the fee to the referrer's ATA.
  - If that ATA doesn't exist, the SDK first creates it with `createAssociatedTokenAccountIdempotent`, and the **sender pays its rent once**.
  - No setup is needed on our side.

---

## 8. Phased implementation

| Phase | Work | Key files |
|---|---|---|
| **0. Spike** | Install the SDK packages and make sure `next build` succeeds (ESM, polyfills, `transpilePackages`). In a scratch script, run a Solana Devnet → Base Sepolia transfer of 1 BRDGTST with a keypair, through `nttExecutorRoute`. This confirms the config values, executor delivery, and the 0.5% referrer fee on both VMs. | `package.json`, `next.config.mjs` |
| **1. Test Mode** | `NetworkModeProvider` with persistence, the per-mode `ACTIVE_CHAINS`, the `useActiveChains()` hook, wagmi with all 4 EVM chains, the mode-aware Solana endpoint, the mode-aware Relay base URL, testnet token maps, and the "Test Mode ON/OFF" toggle plus Testnet badge in the card header. Flipping the toggle resets the card. | `config/blockchain_config.ts`, `config/active_chains.ts`, `config/relay_config.ts`, `config/token_info/index.ts`, `config/ui_config.ts`, `lib/network/network-mode.tsx`, `lib/wallets/*`, `lib/relay/client.ts`, `components/bridge/bridge-card.tsx`, `chain-selector.tsx`, `connect-button.tsx`, `chain-icons.tsx` (testnet icons reuse the mainnet ones) |
| **2. Provider abstraction** | Add `lib/bridge/*`, the Relay adapter, and `use-bridge-quote`. Refactor `BridgeCard` / `QuoteSummary` / `SwapProgress` onto the neutral types. **Relay behaviour must not change.** Regression-test a mainnet Relay swap. | `lib/bridge/*`, `hooks/use-bridge-quote.ts`, `components/bridge/*` |
| **3. NTT provider** | Add `config/ntt_config.ts`, the registry (filtered by Test Mode), the Wormhole context (one per network), the route builder, the signer adapters (including the Solana extra-signer support), quote/execute/track, the 0.5% `getFee` callback, capacity checks, and the manual redeem. | `config/ntt_config.ts`, `lib/ntt/*`, `lib/wallets/signers.ts` |
| **4. UI** | Pairing lock, NTT badge, precision cap, capacity/gas errors, the fee rows, NTT stages and copy, Wormholescan links, the long-ETA messaging, and resume-from-localStorage. | `components/bridge/*`, `config/ui_config.ts` |
| **5. Docs** | Update `Bridge UI.md`, `Cross-chain Swaps and Bridging.md`, and `Connecting Web Wallets.md`. Add a "How to add an NTT token" checklist. | `docs/dev_notes/*` |

### "Add a new NTT token" checklist (target end state)
1. Add the token to `config/token_info/<chain>_tokens.ts` for each chain.
2. Add the deployment to `NTT_BRIDGE_INFO` with the manager, transceiver, token, and mode for each chain.
3. If a chain is new, add its `CHAINKEY_TO_WORMHOLE_CHAIN` mapping.
4. Optionally add a token icon under `src/image/tokens`.
No code changes are needed.

---

## 9. Test plan (BRDGTST)
Prerequisites: devnet SOL, Base Sepolia ETH, and BRDGTST in a Phantom devnet wallet (the mint authority `CCwW3y…` can mint more).
1. Solana Devnet → Base Sepolia, 1 BRDGTST. Check that the executor delivers and the Base balance goes up by 1.
2. Base Sepolia → Solana Devnet, 0.5 BRDGTST. Check the approve + transfer flow, the long-ETA messaging, and the Solana balance.
3. Amount above 100 BRDGTST from Base: check that the capacity error appears and nothing is sent.
4. Amount with 9 decimals: check that the input is capped at 8.
5. Reject in the wallet at each step: check the failure state.
6. Close the tab mid-transfer, then reopen: check that the transfer resumes.
7. Force a manual redeem, e.g. by using a destination tx with too-low gas or skipping the executor: check that the "Redeem manually" path works.
8. Test Mode OFF: check that Relay mainnet swaps are unchanged and that BRDGTST is not listed.
9. Test Mode toggle:
   - the label reads OFF/ON correctly;
   - flipping it resets the card;
   - it is disabled mid-transfer;
   - the choice persists across a reload;
   - the EVM wallet stays connected and switches network when a step needs it;
   - the Solana wallet stays connected on the devnet endpoint.
10. Set `TEST_MODE_TOGGLE_VISIBLE = false`: check that the toggle disappears and the app runs with Test Mode OFF, even if Test Mode ON was stored.
11. Test Mode ON with a Relay token (e.g. ETH Sepolia → Base Sepolia, or Solana Devnet using Relay chain id 901): the quote either works or fails gracefully.
12. Fee: the recipient gets `amount − 0.5%` (trimmed), and the fee lands at `FEE_RECIPIENT_ADDRESSES[source]` on both directions.
13. Mobile and desktop layouts for every new state, including the toggle row in the card header.

---

## 10. Decisions (lead, 2026-10-18)
| # | Question | Decision | Where applied |
|---|---|---|---|
| 1 | How to switch mainnet/testnet | **In-app "Test Mode" toggle** whose label reads `ON` / `OFF`. **It ships on production.** It is shown or hidden by `TEST_MODE_TOGGLE_VISIBLE = true` in `config/ui_config.ts` | §4.1, §4.5 |
| 2 | Referrer fee on NTT routes | **0.5%, the same as Relay** (`UNIVERSAL_FEES.ALL` → 50 bps, as an absolute `transferTokenFee`, paid to `FEE_RECIPIENT_ADDRESSES[source]`) | §7 |
| 3 | `NTT_BRIDGE_INFO` shape | **Chain-keyed `chains: {}` map plus `network`.** Already applied in `config/blockchain_config.ts` | §5.2 |
| 4 | Relay while Test Mode is ON | **Use Relay testnets** (`api.testnets.relay.link`) | §4.4 |
| 5 | Destination gas drop-off | **Dropped.** Too confusing for users, so it is not built (see Non-Goals) | §1 |
| 7 | Relay chain id for Solana Devnet | **901**, the existing `SOLANA_DEVNET.chainId` in `config/chain_info.ts` | §4.4 |
| 6 | BRDGTST display name | **"Bridge Test 48"**, matching on-chain metadata. Already applied in both `token_info` files. The symbol is `BRDGTST`; "BRDTST" in the info file's name is a typo | §3 |

No open decisions remain.

---

## 11. Implementation status (2026-10-18)

All phases are implemented, `tsc` is clean, and `next build` succeeds.

### Phase 0 spike results
The spike was a read-only `validate` + `quote` against testnet, with no funds moved.

| | Solana Devnet → Base Sepolia | Base Sepolia → Solana Devnet |
|---|---|---|
| 0.5% fee | 1.12345678 in → 1.1178395 out ✓ | 0.5 in → 0.4975 out ✓ |
| Executor relay fee | 0.000166 SOL | 0.000489 ETH |
| ETA | ~18 s | ~17 min |
| Capacity | outbound 100 / inbound 1000 ✓ | **Solana inbound limit from Base Sepolia = 0** ⚠️ |

**Action needed on the deployment:** Solana's inbound rate limit for chain 10004 is 0. Every Base → Solana transfer would sit in the destination queue for 24 h. The UI blocks these with "Exceeds bridge capacity (0 BRDGTST available)" until the limit is raised (`ntt` CLI, then `ntt push`).

### Findings that shaped the code
- `@wormhole-foundation/sdk-*` peers are pinned to exactly `6.1.4`, and the NTT packages are `8.0.1`.
- `sdk-evm-ntt` and `sdk-solana-ntt` must be registered explicitly with `register()`.
- `route.track()` is a **single pass**, so the provider polls it until delivery.
- A relay failure is *not* terminal: the VAA can still be redeemed manually. The UI therefore shows "Redeem manually" instead of a failure.
- `sdk-solana` bundles its own `@solana/web3.js`, so the Solana signer uses structural checks, not `instanceof`.
- The extensionless `import "./side-effects"` in `sdk-solana-ntt` breaks raw Node ESM but is fine under Next's bundler. `transpilePackages` was not needed.
- The SDK is code-split into its own ~2.3 MB chunk and is downloaded only when an NTT route is quoted.

### Deviations from the plan
- **Toggle placement:** the "Live"/"Testnet" badge stays next to the title. The Test Mode switch with its ON/OFF label sits on the right of the header, before "Operational", and wraps under the title on narrow screens.
- **Inherited bug fixed:** the 20 s Relay quote auto-refresh never re-fetched, because the timer reset the cache key but nothing re-ran the effect, so the button stuck on "Fetching quote…". `useBridgeQuote` now bumps a refresh tick.
- **Closing the progress modal mid-flight now keeps the card locked.** Clicking the "Bridging…" button reopens the modal. Before, closing the modal unlocked the card mid-transfer.
- `hooks/use-relay-quote.ts` is no longer imported anywhere. It was left in place and can be deleted.

### Not yet verified
- No real transfer was signed. A live wallet run of §9 (tests 1–7 and 11) is still needed, using a Phantom devnet wallet and a Base Sepolia EVM wallet.
- Relay testnet quotes, including Solana Devnet as chain 901, have not been exercised.

---

## Sources
- Wormhole — Integrate NTT with Executor: https://wormhole.com/docs/protocol/infrastructure-guides/ntt-executor/
- Wormhole — Standard Relayer → Executor migration: https://wormhole.com/docs/protocol/infrastructure/relayers/executor-vs-sr/
- Wormhole blog — Migrating from Standard Relay to Executor: https://wormhole.com/blog/migrating-from-standard-relay-to-executor-relay-what-every-wormhole-builder-needs-to-know
- NTT post-deployment guide: https://wormhole.com/docs/products/native-token-transfers/guides/post-deployment
- NTT repo / SDK: https://github.com/wormhole-foundation/native-token-transfers (npm `@wormhole-foundation/sdk-route-ntt@8.0.1` type definitions inspected)
- On-chain reads: Base Sepolia RPC, Solana Devnet RPC, `executor-testnet.labsapis.com/v0/capabilities` (all 2026-10-18)
