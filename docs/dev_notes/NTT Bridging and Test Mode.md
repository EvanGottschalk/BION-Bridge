# NTT Bridging and Test Mode

How tokens with their own Wormhole **Native Token Transfers (NTT)** deployment
are bridged, and how the app switches between mainnet and testnet. Background
research and decisions: `plans/2 - NTT Bridge Integration Plan.md`. Companion
docs: `Bridge UI.md`, `Cross-chain Swaps and Bridging.md`,
`Connecting Web Wallets.md`.

## 1. Test Mode

- **State:** `lib/network/network-mode.tsx`.
  - `NetworkModeProvider` is mounted outermost in `lib/wallets/provider.tsx`. It exposes `useNetworkMode()` → `{ testMode, setTestMode, toggleVisible }` and `useActiveChains()`.
  - The first render always uses `TEST_MODE_DEFAULT`, so SSR markup matches. The viewer's stored choice (`TEST_MODE_STORAGE_KEY`, localStorage, guarded with try/catch) is applied after mount.
- **Visibility:** `TEST_MODE_TOGGLE_VISIBLE` in `config/ui_config.ts`. When it is `false`, the toggle is hidden and the app always runs on mainnet, whatever was stored.
- **Chains:** `config/active_chains.ts`.
  - `ACTIVE_CHAINS_BY_MODE` holds `mainnet` (`ethereum`, `base`, `solana`) and `testnet` (`sepolia`, `baseSepolia`, `solanaDevnet`).
  - `ALL_CHAINS` is the union, used for id and key lookups.
  - Each `ActiveChain` carries a `chainKey` (its `CHAINS.*` key) and `isTestnet`.
  - Relay chain ids on testnet: Sepolia `11155111`, Base Sepolia `84532`, Solana Devnet `901`.
- **Wallets:**
  - wagmi always registers all four EVM chains (`lib/wallets/evm.ts`), so switching modes never remounts it.
  - The Solana `ConnectionProvider` endpoint follows the mode (`useSolanaEndpoint(testMode)`).
  - The EVM pill shows "Wrong network" when the wallet is on a chain outside the current mode.
- **Relay:** `getRelayApi(testnet)` (`lib/relay/client.ts`) uses `RELAY_API_BASE_TESTNET` for testnet chains. Callers derive `testnet` from `ActiveChain.isTestnet`.
- **Card behaviour:** flipping the toggle resets `BridgeCard` to `DEFAULT_CHAIN_PAIR_BY_MODE`. The toggle is disabled while a transfer is in flight.

## 2. Provider architecture

```
BridgeCard ── useBridgeQuote ── router.selectProviderId(route) ── 'relay' | 'ntt'
                                router.loadProvider(id)  (NTT is a dynamic import)
           ── provider.execute → provider.track → (provider.redeem) → BridgeProgress
```

- `lib/bridge/types.ts` holds the provider-neutral `BridgeRoute`, `BridgeQuote`, `BridgeProgress`, and `BridgeProvider`.
- `lib/bridge/router.ts` is the **only** place that decides between Relay and NTT. It picks NTT when both tokens belong to the same `NTT_BRIDGE_INFO` deployment on different chains.
- `lib/bridge/providers/relay.ts` wraps the existing `lib/relay/*` code unchanged. The Relay status → progress mapping lives here.
- `lib/bridge/providers/ntt.ts` is the Wormhole NTT provider. It uses Executor relaying: the Standard Relayer shut down on 2026-04-01.
- `lib/ntt/registry.ts` is a config-only lookup with no SDK import, used by the token selector and card. `lib/ntt/pending.ts` holds resume records.
- `lib/ntt/wormhole.ts` builds the SDK context (with our RPCs) and the `nttExecutorRoute` from config, including the `getFee` callback. `lib/ntt/signers.ts` adapts our wallet signers to the SDK's `SignAndSendSigner`.

## 3. The NTT flow

1. **Quote:**
   - `validate` trims the amount to 8 decimals and computes our fee. `quote` fetches the Executor's signed quote.
   - We then check the source **outbound** capacity and the destination **inbound** capacity ourselves. Amounts over either throw `BridgeQuoteError(code: 'capacity')`, and the button reads "Exceeds bridge capacity".
2. **Execute:** `route.initiate` builds the transactions and our signer adapters send them.
   - EVM sends approve, then transfer, waiting for each receipt.
   - Solana: the wallet signs first, then the SDK's outbox keypair.
   - The last origin tx is saved to localStorage for resume.
3. **Track:** `route.track()` is a single pass, so the provider loops it every `NTT_TRACK_POLL_INTERVAL_MS` for up to `NTT_TRACK_TIMEOUT_MS`. Progress-bar stages:
   - 0: submitted
   - 1: signed by Guardians
   - 2: delivering, or queued by rate limit
   - 3: complete
4. **Manual redeem:** shown when one of these happens:
   - the Executor reports a relay failure;
   - delivery is overdue (`NTT_MANUAL_REDEEM_AFTER_MS` after attestation);
   - a rate-limit-queued transfer passes its release time.

   Redeem runs `route.complete` (or `route.finalize` for a queued transfer) with the destination wallet.
5. **Destination-side Redeem panel** (`components/bridge/ntt-redeem-panel.tsx`):
   - Shown under "You Receive" whenever an NTT pair is selected.
   - The user pastes the source tx hash (prefilled from the latest pending record) and clicks Redeem. `nttProvider.redeemByTx` then:
     - rebuilds the receipt from config;
     - fetches the Guardian VAA;
     - checks that the VAA targets this destination chain;
     - checks on-chain whether it was already delivered;
     - redeems with the connected destination wallet.
   - The connected wallet only pays gas. Tokens always go to the recipient encoded in the VAA.
6. **Robustness rules** (from the first live test, 2026-10-18):
   - The origin tx is recorded **the moment it's broadcast**, via the signer's `onSent`. An error after broadcast continues to tracking instead of a dead-end failure.
   - Solana confirmation polls `getSignatureStatuses` over HTTP. The websocket-based `confirmTransaction` could report "expired" for a tx that had landed.
   - Delivery state is read directly from the destination NttManager (`getIsExecuted`, `getIsApproved`, `getInboundQueuedTransfer`). The Executor status API can be down; it returned errors on 2026-10-18.
7. **Resume:** on load, the most recent pending record for the current mode is rebuilt as a SourceInitiated receipt and tracked again. Records are removed on completion, after 7 days, or when no VAA ever appeared.

**Fees:** our fee is `UNIVERSAL_FEES.ALL` (0.5% → `NTT_REFERRER_FEE_BPS = 50`).
- It is taken in the bridged token on the source chain and paid to `FEE_RECIPIENT_ADDRESSES[source ChainKey]`.
- On Solana, the SDK creates the recipient's Token-2022 ATA if it is missing; the sender pays the rent once.
- The user also pays the Executor relay fee in source-chain native gas. It is shown as "Relay fee" and checked against the native balance ("Insufficient gas for relay fee").

## 4. Adding a new NTT token

1. Add the token to `config/token_info/<chain>_tokens.ts` for each chain. Optionally add it to `FEATURED_TOKENS_BY_CHAIN`.
2. Add the deployment to `NTT_BRIDGE_INFO` (`config/blockchain_config.ts`): `network`, plus a `chains` entry per `ChainKey` with the token, manager, transceiver, and mode.
   - On Solana the transceiver is the manager program itself.
   - On EVM, read it from `NttManager.getTransceivers()`.
3. If a chain is new to NTT, map it in `WORMHOLE_CHAIN_BY_CHAINKEY` (`config/ntt_config.ts`).
4. Make sure `FEE_RECIPIENT_ADDRESSES` has an entry for every source chain.

No code changes are needed.

## 5. Known caveats

- The Wormhole SDK pins `@wormhole-foundation/sdk-*` to exactly `6.1.4`. Upgrade all `@wormhole-foundation/*` packages together.
- `sdk-solana` bundles its own `@solana/web3.js`. Don't use `instanceof` on SDK-built transactions.
- BRDGTST: Solana's inbound limit from Base Sepolia was 0 on 2026-10-18, so Base → Solana is blocked until that limit is raised.
