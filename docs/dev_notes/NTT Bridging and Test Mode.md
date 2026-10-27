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
   - 1: signed by Guardians → **ready to redeem**
   - 2: delivering, or queued by rate limit
   - 3: complete
4. **Redeem (every NTT transfer):** the user always redeems on the destination chain. The **primary bridge button** drives it (`BridgeCard`'s `primary` state):
   - While submitting/waiting for Guardians: spinner, "Bridging…", disabled. A "View transfer status" link below reopens the progress modal.
   - Once the VAA is signed (`canRedeem` on the progress): enabled "**Redeem**" (or "Connect … wallet to redeem", disabled, if the destination wallet isn't connected). The progress modal shows the same Redeem button.
   - Clicking runs `route.complete` (or `route.finalize` for a rate-limit-queued transfer past its release time) with the destination wallet; tracking then runs to "Complete" and the button returns to normal.
   - `redeem` re-reads the destination NttManager first; if the Executor already delivered, it skips the tx.
   - Redeem is also offered when the Executor reports a relay failure.
   - The Test Mode toggle is disabled while a transfer is bridging or redeemable.
5. **Backup "Redeem past transfers" panel** (`components/bridge/ntt-redeem-panel.tsx`):
   - Shown **below the primary button** whenever an NTT pair is selected; collapsed by default. For transfers the primary button can't reach (e.g. sent from another browser).
   - **Show Past Transactions** (`components/bridge/ntt-history-list.tsx`, above the hash field) lists up to `NTT_HISTORY_LIMIT` (10) past NTT bridgings for the connected EVM and Solana wallets, across all NTT routes in the current mode. The button always reads "Show Past Transactions"; every press re-fetches the list and statuses, so new transfers appear:
     - Source: Wormholescan's operations API (`WORMHOLESCAN_OPERATIONS_URL`, `lib/ntt/history.ts`), one request per wallet, merged and newest first. Only tokens in `NTT_BRIDGE_INFO` on supported chains are kept (matched on `tokenChain` + `tokenAddress`).
     - Each row: bridged amount (after our fee, as encoded in the VAA), route, local date/time, truncated source tx linking to that chain's explorer, and a copy-hash button.
     - Status is read **on-chain**, not from Wormholescan (its `targetChain` field was empty on testnet even for redeemed transfers). `getNttTransferStatus` (in `lib/bridge/providers/ntt.ts`, loaded via `router.loadNttTransferStatus`) decodes the VAA Wormholescan returned and asks the destination NttManager: Redeemed / Queued / **Redeem** button / Awaiting signatures (no VAA yet) / Unavailable.
     - Redeem goes through the same `redeemByTx` path as the pasted hash. The button is disabled until a wallet for the destination chain is connected. The list re-checks after each transfer or redeem finishes.
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
   - **Wallets must not reorder Solana instructions** (from the first Base → Solana redeem, 2026-10-26). A Solana redeem starts with `Core.VerifySignature` = [secp256k1 precompile, `verify_signatures`]. The SDK's secp256k1 instruction reads its signature, key and message from **instruction index 0**. Phantom prepends two ComputeBudget (priority fee) instructions to any tx that has none, which moved the precompile to index 2. It then read a 5-byte ComputeBudget instruction and failed with `custom program error: 0x2` (InvalidSignature), with no logs for that instruction. Three safeguards:
     1. `lib/ntt/signers.ts` appends `SetComputeUnitLimit` + `SetComputeUnitPrice` to the **end** of every legacy SDK tx before the wallet signs, using the SDK's own `createPriorityFeeInstructions` (simulated units × 1.2; percentile fee from `SOLANA_PRIORITY_FEE` in `config/solana_config.ts`). Wallets leave txs that already set a priority fee alone. v0 txs (lookup tables, no precompiles) are left unchanged.
     2. `signAndSendTx` (`lib/wallets/signers.ts`) checks the **signed** tx with `findPrecompileOffsetProblems` (`lib/wallets/solana-diagnostics.ts`). If any secp256k1/Ed25519 data offset points outside its referenced instruction, the tx is not sent and the UI shows `SOLANA_TX_COPY.instructionsReordered`.
     3. Every failed Solana send/confirmation logs a `[solana] … transaction failed.` console report: the decoded custom error (program name + error name from `SOLANA_PROGRAM_ERRORS`), precompile offset problems, full logs via `SendTransactionError.getLogs()`, and the instruction list. UI error text is unchanged.
7. **Resume:** on load, the most recent pending record for the current mode is rebuilt as a SourceInitiated receipt and tracked again (so the primary button shows "Redeem" again for an unredeemed transfer). Records are removed on completion, after 7 days, or when no VAA ever appeared.

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
