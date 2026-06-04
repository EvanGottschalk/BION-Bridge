# Cross-chain Swaps and Bridging

How a cross-chain swap actually happens once the user clicks the Swap button.
This file documents the bridging *backend* — the protocol, the API calls, the
step execution, the status poller, and the fee/verification machinery. The UI
that sits on top of all this is documented in `Bridge UI.md`; the wallet
plumbing that signs transactions is in `Connecting Web Wallets.md`.

## 1. Why Relay

We are a non-custodial frontend. We don't operate any infrastructure that
holds funds, runs solvers, or coordinates cross-chain message passing. All of
that is outsourced to the **Relay Protocol** (https://relay.link). Their
solver network watches for user deposits on the origin chain and fills the
destination side in exchange for a fee. From our perspective, Relay is a
single HTTP API plus a step format we execute against the user's wallet.

Relay supports both **bridges** (same currency on a different chain) and
**swaps** (different currency on the same or a different chain). Both come
out of the same `/quote/v2` endpoint, return the same `steps[]` shape, and
are tracked through the same `/intents/status/v3` poller. Our code does not
branch between the two cases — see `lib/relay/quote.ts:buildQuoteRequest`,
which produces a single Relay quote for any (origin chain, origin token,
destination chain, destination token) tuple.

## 2. The Relay flow at 10,000 ft

```
[user inputs] ──► [Quote]   POST /quote/v2          → { steps, fees, details }
                     │
                     ▼
                  [Execute] iterate steps[]
                     │      for each step.item:
                     │        kind:'transaction' → wallet.sendTx(data)
                     │        kind:'signature'   → wallet.signTypedData(data)
                     ▼
                  [Status]  GET /intents/status/v3?requestId=…
                     │      poll every 1 s until status ∈ terminal set
                     ▼
                  [Done]
```

Three subsystems in our `lib/relay/` directory implement these three phases:

| File                     | Role                                                  |
|--------------------------|-------------------------------------------------------|
| `lib/relay/client.ts`    | `fetch` wrappers for every Relay endpoint             |
| `lib/relay/quote.ts`     | Build request, parse response, decimal conversion     |
| `lib/relay/execute.ts`   | Iterate `steps[]`, dispatch by VM, drive signers      |
| `lib/relay/status.ts`    | 1 s poller against `/intents/status/v3` with timeout  |
| `lib/relay/types.ts`     | TS types for every Relay payload we touch             |
| `lib/relay/verify-fees.ts` | Post-launch sanity check: did `paidAppFees` arrive  |

## 3. The HTTP client (`lib/relay/client.ts`)

A thin wrapper around `fetch`. All endpoint paths come from
`config/relay_config.ts` so we never hard-code Relay URLs in our code:

```
RELAY_API_BASE            = 'https://api.relay.link'
RELAY_QUOTE_PATH          = '/quote/v2'
RELAY_STATUS_PATH         = '/intents/status/v3'
RELAY_CURRENCIES_PATH     = '/currencies/v2'
RELAY_CHAINS_PATH         = '/chains'
RELAY_REQUESTS_PATH       = '/requests/v2'        (post-hoc verification)
RELAY_EXECUTE_PERMITS_PATH= '/execute/permits'    (permit POST-back)
relayAppFeesBalancePath   = '/app-fees/:wallet/balances'
relayAppFeesClaimPath     = '/app-fees/:wallet/claim'
```

`buildHeaders` always sets `Content-Type: application/json` and, if
`NEXT_PUBLIC_RELAY_API_KEY` is defined, sends `Authorization: Bearer …`. An
unauthenticated request still works against the public Relay API but is rate-
limited.

`ensureOk` throws a `RelayApiError(status, body)` on non-2xx so callers get
the upstream body in the message — useful when Relay rejects a malformed
quote request with a JSON error.

The named methods on `relayApi` (`getQuote`, `getStatus`, `searchCurrencies`,
`getChains`, `getAppFeeBalances`, `claimAppFees`, `postPermit`) are the only
surface area the rest of the app uses; nobody calls `fetch` directly against
Relay anywhere else.

## 4. Quoting (`lib/relay/quote.ts` + `hooks/use-relay-quote.ts`)

### 4.1 The hook

`useRelayQuote` takes the same shape the bridge card already has on screen —
chains, tokens, amount, user, recipient — and returns one of four states:

```ts
{ kind: 'idle' }
{ kind: 'loading'; previous?: ParsedQuote }
{ kind: 'ready'; quote: ParsedQuote; fetchedAt: number }
{ kind: 'error'; message: string; previous?: ParsedQuote }
```

Behaviour:

1. **Guards** — `argsReady` returns false if anything is missing (wallet,
   amount, tokens) or if it's a true no-op (same chain + same token). The
   hook stays `idle` in that case.
2. **Cache key** — a JSON-stringified snapshot of the inputs. If the key
   matches the last fetch and we already have a `ready` quote, skip.
3. **In-flight cancellation** — every new request aborts the previous one via
   `AbortController`. We never write to state from an aborted fetch.
4. **Optimistic previous quote** — when transitioning to `loading`, we carry
   the previous quote forward in `previous` so the UI doesn't blink. The
   `QuoteSummary` and the "You receive" amount both read from `previous`
   while a refresh is in flight (`bridge-card.tsx:166`).
5. **Debounce** — input changes are debounced by `RELAY_QUOTE_DEBOUNCE_MS`
   (400 ms) so we don't spam Relay while the user is still typing.
6. **Auto-refresh** — after a `ready` quote, a second `useEffect` sets a
   `RELAY_QUOTE_REFRESH_MS` timer (20 s). When it fires we invalidate the
   cache key and fall back into `loading` with the previous quote, which
   re-triggers the fetch effect.

### 4.2 Building the request

`buildQuoteRequest(args)` produces a `RelayQuoteRequest`:

```ts
{
  user,                           // origin-chain wallet address
  originChainId,                  // from RELAY_CHAIN_INFO via getActiveChain
  destinationChainId,
  originCurrency,                 // address or sentinel
  destinationCurrency,
  amount,                         // string, base units (BigInt-safe)
  tradeType: 'EXACT_INPUT',       // we always specify the input amount
  recipient: args.recipient ?? args.user,
  refundTo:  args.refundTo  ?? args.user,
  appFees: [{ recipient: RELAY_FEE_RECIPIENT, fee: '50' }],
}
```

A few details that matter:

- **Native token sentinels** — `NATIVE_EVM_ADDRESS` (the zero address) for
  ETH on Ethereum/Base; `NATIVE_SOL_ADDRESS` (the system program ID,
  `11111111111111111111111111111111`) for SOL on Solana. Relay recognises
  these as "the native gas token" instead of an ERC-20/SPL address.
- **Base-unit conversion** — `toBaseUnits('1.23', 9)` → `1_230_000_000n`. We
  do the multiplication in `bigint` so we can quote any decimals (USDC's 6,
  WBTC's 8, ETH's 18) without floating-point loss. Input is regex-validated
  before this point.
- **`recipient`** — for cross-VM swaps (e.g. SOL → ETH), the recipient is the
  *destination* wallet's address, which is a different account than `user`.
  The bridge card passes the destination wallet's address; if absent we fall
  back to `user`, which is correct for same-VM swaps.
- **`refundTo`** — where Relay sends the funds back if the swap fails. We
  always set it to the origin wallet (`user`) so refunds land in the same
  account that paid in.
- **`appFees`** — exactly one entry, recipient = `RELAY_FEE_RECIPIENT` (from
  `config/fees_config.ts`), amount = `RELAY_APP_FEE_BPS` = 50 bps = 0.5%.
  Relay returns it as a separate line item in `fees.app` and pays it out via
  its app-fee accumulator (see §8). If the bps is 0 we omit the field
  entirely.

### 4.3 Parsing the response

`parseQuote(resp)` lifts the fields the UI actually needs into a flatter
`ParsedQuote`:

```
outputAmountFormatted   ← details.currencyOut.amountFormatted
outputAmountUsd         ← details.currencyOut.amountUsd
outputSymbol            ← details.currencyOut.currency.symbol
rate                    ← details.rate
feeBreakdownUsd.{gas,relayer,relayerService,relayerGas,app,subsidized}
                        ← fees.*.amountUsd
totalImpactUsd/Percent  ← details.totalImpact.{usd,percent}
timeEstimateSeconds     ← details.timeEstimate
slippagePercent         ← details.slippageTolerance.destination.percent
requestIds              ← unique steps[].requestId values
```

`requestIds` is deduped because Relay returns the same `requestId` on every
step of a single intent — the dedupe just protects us from polling twice if
something upstream changes.

## 5. Step execution (`lib/relay/execute.ts`)

A Relay quote returns `steps: RelayStep[]`. Each step has:

```ts
{
  id: string,
  action: string,         // human-readable
  description: string,
  kind: 'transaction' | 'signature',
  requestId: string,
  items: RelayStepItem[], // usually 1, but can be more
}
```

`executeSteps(steps, opts)` iterates steps in order. For each `item` that
isn't already `complete`, it dispatches by `step.kind`:

### 5.1 `kind: 'transaction'`

`runTxItem` inspects `data.chainId` to pick a VM:

- `isEvmChainId(chainId)` → use `opts.evm` (the `EvmSigner`).
- `isSolanaChainId(chainId)` → use `opts.svm` (the `SvmSigner`).

If `data.chainId` is missing — Solana steps frequently omit it — we fall
back to `opts.originChainId` (which the bridge card passes in from
`getActiveChain(fromChain).relayChainId`) and use heuristic checks:
`looksLikeEvmStep` matches `to` against `0x[a-fA-F0-9]{40}`;
`hasSolanaTxBlob` runs `extractSolanaBase64Tx` over the payload. This is
defensive — Relay's schema isn't always rigidly typed — but the heuristics
are conservative enough not to misclassify.

**EVM path:**

1. `evm.switchChain(chainId)` — surfaces the network-switch prompt if the
   user's wallet is elsewhere. Critical: omitting this is the most common
   reason an EVM swap fails silently.
2. Decode `to`, `data`, `value`, gas hints with the `hex(...)` / `toBig(...)`
   helpers (gas hints are EIP-1559 only — no legacy `gasPrice`).
3. `evm.sendTransaction({ chainId, to, data, value, maxFeePerGas,
   maxPriorityFeePerGas })` → tx hash.
4. Record the tx hash on `result.txHashes`, fire `onProgress({ kind:
   'tx-sent', ... })`.

**Solana path:**

1. Try `extractSolanaBase64Tx(data)` first. It tries the documented field
   names (`transaction`, `serializedTransaction`, `tx`, `txBase64`, …) and
   then recursively scans the object for any string that looks like a
   serialized transaction (base64 chars, length 150–32768). This survives
   minor changes in Relay's payload shape without code changes.
2. If we find a base64 blob, `svm.sendBase64Tx` deserializes it (versioned
   first, legacy as fallback) and broadcasts it.
3. Otherwise, if `data.instructions` is present, hand the whole payload to
   `svm.sendRawInstructions`. That signer reconstructs a v0 message:
   - Decode each `{ programId, keys, data: hex }` into a
     `TransactionInstruction`.
   - Resolve every `addressLookupTableAddresses[i]` via
     `connection.getAddressLookupTable`.
   - Compile `new TransactionMessage(...).compileToV0Message(altAccounts)`.
   - Sign + broadcast via `connection.sendRawTransaction`.

If neither shape matches, throw with a `describeKeys(data)` diagnostic so we
can tell what Relay actually sent.

### 5.2 `kind: 'signature'`

`runSigItem` calls `opts.evm.signTypedData(...)` with the step's typed-data
payload (`domain`, `types`, `primaryType` defaults to `'Permit'`, `message`).
Then, if `data.post.endpoint` is set, we POST the signed payload back to
Relay via `relayApi.postPermit(endpoint, { kind: 'request', requestId })`. This
is how Relay collects an EIP-2612 / permit-style approval without a separate
on-chain `approve` transaction — the user only signs once.

Signature steps require the EVM signer; we don't currently support Solana
signature-only steps (Relay doesn't emit them for the routes we offer).

### 5.3 Progress callbacks

`onProgress` fires four kinds of event:

```
{ kind: 'step-start';    step, itemIndex }
{ kind: 'tx-sent';       step, itemIndex, chainId, txHash }
{ kind: 'sig-sent';      step, itemIndex, signature }
{ kind: 'step-complete'; step }
```

The bridge card uses `tx-sent` and `sig-sent` to update the modal copy
("Transaction broadcast. Waiting for solver…" / "Signature submitted."). We
don't render anything from `step-start` or `step-complete` today, but they're
emitted so a future per-step UI can light up.

### 5.4 The `ExecuteResult`

`executeSteps` returns `{ requestId, txHashes[], signatures[] }`. The
`requestId` is taken from `steps[0]` and is what the status poller uses.
`txHashes` and `signatures` are kept around for debugging and potential
explorer-link rendering — the bridge card currently sources its origin hash
from the status response, not the execute result.

## 6. Status polling (`lib/relay/status.ts`)

After execution returns, the bridge card calls:

```ts
pollStatus(requestId, { onUpdate: s => setProgress({ kind: 'polling', s }) });
```

`pollStatus`:

1. Polls `GET /intents/status/v3?requestId=…` every
   `RELAY_STATUS_POLL_INTERVAL_MS` (1 s) until the response status is in
   `RELAY_TERMINAL_STATUSES` (`'success' | 'failure' | 'refunded'`) — or
   `'refund'`, which Relay sometimes uses interchangeably with `'refunded'`.
2. Times out after `RELAY_STATUS_POLL_TIMEOUT_MS` (10 min) by throwing.
3. Swallows transient HTTP errors and keeps polling — Relay can return 5xx
   briefly while a tx is propagating, and one bad response shouldn't kill the
   user's swap.
4. Honours an `AbortSignal` if the caller provides one (we currently don't,
   but it's wired through).

The non-terminal status values (`waiting`, `pending`, `submitted`, `delayed`)
are forwarded into the UI via `onUpdate`. `STAGE_ORDER` in `swap-progress.tsx`
maps them to a four-segment progress bar.

`statusResp.inTxHashes[0]` and `statusResp.txHashes[0]` are the origin and
destination transaction hashes respectively, used to build explorer links via
`buildExplorerTxUrl` in `config/active_chains.ts`.

## 7. End-to-end timeline

For a SOL → USDC-on-Base swap, the wall-clock sequence is roughly:

```
t=0.0s   User clicks Swap                       → progress modal opens
t=0.1s   Phantom popup: "Sign this transaction" → svm.sendBase64Tx awaits
t=2.0s   User signs, Solana broadcasts          → onProgress 'tx-sent'
t=2.1s   pollStatus starts, status='waiting'    → progress bar segment 1
t=2.5s   status='pending'                       → segment 2 (solver picked it up)
t=4.0s   status='submitted'                     → segment 3 (Base tx broadcast)
t=8.0s   status='success'                       → progress modal terminal state
                                                  origin + dest explorer links
```

Exact times vary; Relay's quote returns a `details.timeEstimate` in seconds
that we surface as the ETA chip in the quote summary.

## 8. App fees

We earn a 50 bps (0.5%) fee on every quote. The mechanics:

1. `buildQuoteRequest` always sets `appFees: [{ recipient: RELAY_FEE_RECIPIENT,
   fee: '50' }]`. Relay subtracts the fee from the user's output amount
   *inside the quote*, so the displayed "You receive" is already net of our
   cut.
2. The fee accrues to `RELAY_FEE_RECIPIENT` inside Relay's app-fee
   accumulator. It does not land on-chain at swap time — Relay batches it.
3. We can read pending balances via `relayApi.getAppFeeBalances(wallet)` and
   claim them via `relayApi.claimAppFees(wallet, { chainId, currency,
   recipient })`. There is no UI for claim today — it's expected to be a
   future admin screen.
4. **Cross-chain note** — Relay only supports app fees on cross-chain swaps
   today (per their docs), not same-chain swaps. Our scope is cross-chain
   only so this is moot, but worth knowing if same-chain swaps are added
   later.

### 8.1 Verifying fees were collected (`lib/relay/verify-fees.ts`)

`verifyAppFees(recipient, limit)` is a one-shot helper that hits
`GET /requests/v2?recipient=…&limit=…` and joins each row's quoted
`appFees[].amount` against the realised `paidAppFees[].amount`. The returned
rows are:

```ts
{ requestId, status, appFeesQuoted, appFeesPaid, okay }
```

`okay` is true if `quoted === 0n` (we didn't ask for a fee) or `paid > 0n`
(we got something). Use this after every environment promotion — Relay's
own docs flag that an empty `paidAppFees` while `appFees` is set means the
fee wasn't collected for that swap, usually due to a config mismatch.

## 9. Token discovery for the selector

The token selector's "From Relay" results use `relayApi.searchCurrencies`
(`POST /currencies/v2`):

```ts
{
  term: query,
  chainIds: [getActiveChain(chain).relayChainId],
  limit: 20,             // RELAY_TOKEN_SEARCH_LIMIT
  useExternalSearch: true,
}
```

`useExternalSearch: true` opts into a wider corpus that includes long-tail
tokens not in Relay's curated list. Results that already match a locally
defined token (by address) are filtered out before render so the user
doesn't see duplicates. See `Bridge UI.md` §3.2 for the rendering side.

## 10. Failure modes and recovery

| Failure                          | What happens                                    | What user sees |
|----------------------------------|-------------------------------------------------|----------------|
| Quote 400 (bad input)            | `RelayApiError` thrown, `useRelayQuote` → error | Red "Relay API 400: …" banner |
| Quote 5xx / network              | Auto-retry on next debounce cycle               | Stale `previous` quote stays visible |
| User rejects wallet popup        | Signer throws, `executeSteps` propagates        | Progress modal flips to `failure` with wallet message |
| Solana tx confirm timeout        | Silently swallowed; poller takes over           | Progress modal stays in `polling` |
| `pollStatus` hits 10 min timeout | Throws                                          | Progress modal flips to `failure: "Status poll timed out…"` |
| Final status `failure`           | Terminal                                        | Progress modal red X, `details` shown |
| Final status `refunded`          | Terminal                                        | Progress modal amber X, refund explorer link |
| Final status `success`           | Terminal                                        | Progress modal green check, both explorer links |

There is currently no recovery path if the user closes the browser tab during
execution. The on-chain swap is irreversible, so funds will arrive (or
refund) regardless — but our UI loses the `requestId` and won't show the
final state. A future "recent swaps" feature that persists `requestId` to
`localStorage` would close this gap.

## 11. Where every literal lives

Per `CLAUDE.md` rule #1:

| Literal                                  | Source                                  |
|------------------------------------------|-----------------------------------------|
| Relay API base URL                       | `RELAY_API_BASE` in `config/relay_config.ts` |
| Every Relay endpoint path                | Constants/functions in `config/relay_config.ts` |
| App-fee bps                              | `RELAY_APP_FEE_BPS = 50`                |
| App-fee recipient                        | `RELAY_FEE_RECIPIENT` in `config/fees_config.ts` |
| Quote debounce / refresh / status poll   | `RELAY_QUOTE_DEBOUNCE_MS`, `RELAY_QUOTE_REFRESH_MS`, `RELAY_STATUS_POLL_INTERVAL_MS`, `RELAY_STATUS_POLL_TIMEOUT_MS` |
| Terminal statuses                        | `RELAY_TERMINAL_STATUSES`               |
| Native-token sentinels                   | `NATIVE_EVM_ADDRESS`, `NATIVE_SOL_ADDRESS` |
| Chain id ↔ display metadata              | `config/active_chains.ts`               |
| Full chain id ↔ explorer URL table       | `RELAY_CHAIN_INFO` in `config/chain_info.ts` |
| Status modal copy                        | `STATUS_COPY` in `config/ui_config.ts`  |
| Default trade type                       | `RELAY_DEFAULT_TRADE_TYPE = 'EXACT_INPUT'` |
| Token search debounce / limit            | `RELAY_TOKEN_SEARCH_DEBOUNCE_MS`, `RELAY_TOKEN_SEARCH_LIMIT` |

No file under `lib/relay/` or `hooks/use-relay-*` hard-codes any of the above
— if a value isn't in a config file, that's a bug.
