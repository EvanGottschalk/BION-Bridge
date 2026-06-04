# Connecting Web Wallets

The user has to sign transactions on two virtual machines: EVM (Ethereum,
Base) and SVM (Solana). The app integrates *two independent wallet stacks*
side by side, exposes a unified read-only hook for components that just need
"is this chain's wallet connected and what's the address", and a pair of
signer hooks for components that need to actually send transactions. This file
documents the libraries, where they're configured, and how the connect-button
UI ties them together.

Companion docs:
- `Bridge UI.md` — where the connect buttons appear and how the bridge card
  reads wallet state.
- `Cross-chain Swaps and Bridging.md` — what the signers are called with.

## 1. The libraries

| Concern                | Library                                      | Used for           |
|------------------------|----------------------------------------------|--------------------|
| EVM wallet connection  | **wagmi** (`wagmi`)                          | Account state, signing, tx sending |
| EVM connect UI         | **RainbowKit** (`@rainbow-me/rainbowkit`)    | Pretty connect modal, chain switcher |
| EVM RPC + ABI utils    | **viem** (transitively via wagmi)            | Calldata, address types |
| Async cache            | **TanStack Query** (`@tanstack/react-query`) | Required by wagmi  |
| Solana connection      | `@solana/web3.js`                            | RPC client         |
| Solana wallet adapter  | `@solana/wallet-adapter-react` + `-react-ui` | Phantom/Solflare integration |
| Wallet adapter modal   | `@solana/wallet-adapter-react-ui`            | Connect modal      |
| Solana wallet impls    | `@solana/wallet-adapter-wallets`             | Phantom, Solflare  |
| Solana extras          | `@solana/wallet-adapter-base`                | Adapter interfaces |

WalletConnect (used by RainbowKit under the hood for mobile wallets) needs a
project ID, configured via the `NEXT_PUBLIC_WC_PROJECT_ID` env var. If the env
var is missing, wagmi falls back to a connector-less config so the page still
renders (see `lib/wallets/evm.ts:21`).

## 2. Provider tree

`app/providers.tsx` is a one-line client component that mounts
`<WalletProviders>` from `lib/wallets/provider.tsx`. Inside that file the
nesting is:

```
<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    <RainbowKitProvider theme={darkTheme(...)}>
      <ConnectionProvider endpoint={useSolanaEndpoint()}>
        <WalletProvider wallets={useSolanaWallets()} autoConnect>
          <WalletModalProvider>
            {children}
```

The order matters: wagmi depends on QueryClient, RainbowKit depends on wagmi,
and the Solana stack is independent of all of them. `autoConnect` on
`WalletProvider` means a returning user with a previously authorised wallet is
reconnected silently on page load.

The dark theme is themed with `RAINBOW_KIT_THEME_ACCENT` (= `BRAND_PRIMARY` =
`#4A6CF7`) so the RainbowKit modal matches the rest of the app.

## 3. EVM configuration (`lib/wallets/evm.ts`)

```ts
const wagmiConfig = projectId
  ? getDefaultConfig({ appName, projectId, chains: [mainnet, base], transports, ssr: true })
  : createConfig({ chains: [mainnet, base], transports, ssr: true });
```

- **Chains** — exactly `mainnet` and `base` from `wagmi/chains`. These are the
  two EVM chains in `ACTIVE_CHAINS`. Adding a third EVM chain means adding it
  here, in `ACTIVE_CHAINS`, and in `config/chain_info.ts`.
- **Transports** — `http(...)` for each chain, URL coming from
  `resolveRpcUrls(ETH_MAINNET.rpcUrls)[0]` and the same for Base. If
  `NEXT_PUBLIC_ALCHEMY_API_KEY` is missing the Alchemy URL is dropped and the
  public fallback is used.
- **`ssr: true`** — required because Next.js does a server pass first; wagmi
  reads the state from cookies on the server to avoid a flash of disconnected
  state.

`getDefaultConfig` from RainbowKit auto-includes Injected, WalletConnect,
Coinbase Wallet, and Safe connectors. We don't customise the connector list —
RainbowKit's default mobile + extension coverage is good enough.

## 4. Solana configuration (`lib/wallets/svm.ts`)

Two small hooks:

- **`useSolanaEndpoint()`** — runs the Solana mainnet RPC list through
  `resolveRpcUrls` (which substitutes `NEXT_PUBLIC_HELIUS_API_KEY` into the
  Helius URL) and returns the first usable endpoint. Falls back to
  `https://api.mainnet-beta.solana.com/` if everything is filtered out.
- **`useSolanaWallets()`** — returns a memoised array of `PhantomWalletAdapter`
  and `SolflareWalletAdapter`. Backpack and other adapters can be added here
  without touching anything else.

The two are passed into `ConnectionProvider` and `WalletProvider` in the
provider tree above.

## 5. Reading wallet state

`lib/wallets/use-active-wallet.ts` is the only place in the UI that reads
wallet state directly. Two hooks:

### `useActiveWallet(): ActiveWalletInfo`

```ts
{
  evm: { address: string | undefined; isConnected: boolean },
  svm: { address: string | undefined; isConnected: boolean },
}
```

This is what UI code asks when it needs to know "do we have both wallets" or
"what's the EVM address". The EVM half wraps wagmi's `useAccount`; the SVM
half wraps `@solana/wallet-adapter-react`'s `useWallet`. Solana's
`publicKey: PublicKey | null` is converted to a base58 string here so callers
don't have to think about web3.js types.

### `useWalletForChain(chain: ActiveChainKey)`

```ts
{ address: string | undefined; isConnected: boolean }
```

A convenience that returns the *correct half* of `useActiveWallet` for a given
chain key by looking at its `vmType`. This is what `BridgeCard`, `TokenSelector`
balance rows, and `WalletAccountModal` use.

## 6. Signers (`lib/wallets/signers.ts`)

`use-active-wallet.ts` only reads address state. When the bridge actually needs
to *sign and send* transactions, components call `useEvmSigner()` and
`useSvmSigner()`. Both adapt the underlying library APIs into a stable shape
the Relay execution layer can use (`EvmSigner` and `SvmSigner` from
`lib/relay/execute.ts`).

### EVM signer

```ts
type EvmSigner = {
  switchChain(chainId): Promise<void>;
  sendTransaction(req): Promise<`0x${string}`>;  // returns tx hash
  signTypedData(req): Promise<`0x${string}`>;     // EIP-712, used for permits
};
```

`switchChain` is critical: Relay steps target a specific `chainId`, but the
user's wallet might be on a different chain. We call `switchChain` before
`sendTransaction` for every EVM step (see `executeSteps` in
`lib/relay/execute.ts:186`). wagmi's `useSwitchChain` mutation surfaces this
to the wallet UI, which typically pops a "switch network" prompt.

`signTypedData` is used for Permit-style approvals; some Relay routes return a
signature step (`step.kind === 'signature'`) instead of a separate `approve`
transaction. The signed payload is then POSTed to the endpoint Relay specifies
on `data.post.endpoint`.

`sendTransaction` lifts the raw fields from Relay's step payload (`to`,
`data`, `value`, gas hints) and forwards them to wagmi. Gas fields use the
EIP-1559 (`maxFeePerGas` / `maxPriorityFeePerGas`) shape only — legacy `gasPrice`
isn't supported because Relay always returns EIP-1559 hints.

### Solana signer

```ts
type SvmSigner = {
  sendBase64Tx(b64): Promise<string>;             // serialized tx
  sendRawInstructions?(payload): Promise<string>; // structured instructions
};
```

Relay returns Solana steps in two possible shapes:

1. **Base64-encoded transaction blob** — a fully formed
   `VersionedTransaction` or legacy `Transaction`, serialized. We deserialize
   it (trying versioned first, falling back to legacy), let the wallet sign,
   and broadcast via `connection.sendRawTransaction`.
2. **Structured instructions** — an array of `{ programId, keys, data }`
   instruction objects, plus optional `addressLookupTableAddresses`. We
   rebuild a `TransactionMessage`, resolve each ALT via
   `connection.getAddressLookupTable`, compile to a v0 message with the
   resolved tables, wrap in a `VersionedTransaction`, sign, and broadcast.

`extractSolanaBase64Tx` in `lib/relay/execute.ts` walks the step payload to
find a base64 blob even if Relay tucks it under a non-standard key — the
documented fields are tried first (`transaction`, `serializedTransaction`,
`tx`, `txBase64`, …), then a structural recursive scan acts as a safety net
against minor schema drift. The length floor of 150 chars keeps wallet
addresses (~44 base58 chars) from being misidentified as a transaction.

`buildInstruction` does the byte-level reconstruction: pubkeys via
`new PublicKey(...)`, hex instruction data via `decodeHexToUint8` →
`Buffer.from(...)`. The hex decoder rejects odd-length input rather than
silently truncating.

Both code paths confirm the transaction at `'confirmed'` commitment with a
swallowed `.catch(() => {})` — Relay's status poller is what we actually wait
on, so a slow confirm here just means the polling layer takes over a moment
later instead of throwing.

## 7. Connect button UI (`components/bridge/connect-button.tsx`)

The header renders both pills side by side — an EVM pill and a Solana pill —
regardless of which VM the current "from" chain belongs to. This is
deliberate: many users want both wallets connected up-front because
cross-VM swaps need *both* (the source wallet to sign the deposit and the
destination wallet's address as the recipient). For same-VM swaps the second
pill is unnecessary, but seeing it doesn't cost anything and avoids hiding
state from the user.

### EVM pill

Uses `RainbowConnectButton.Custom` (a render-prop API from RainbowKit) so we
can style the pill ourselves while RainbowKit owns the modal and chain logic.
The render prop yields:

- `mounted` — `false` during SSR; return `null` until true.
- `account`, `chain` — undefined if disconnected.
- `chain.unsupported` — true if the wallet is on a chain we didn't include
  in `wagmiConfig.chains`. We render a "Wrong network" pill that opens the
  chain-switcher modal.
- `openConnectModal`, `openChainModal` — opens RainbowKit's dialogs.

When connected, clicking the pill opens our own `WalletAccountModal` (not
RainbowKit's), so the disconnect/copy UI is consistent with Solana.
`disconnectAsync` from wagmi's `useDisconnect` does the actual disconnect.

### Solana pill

Uses the wallet adapter's `useWallet` for state and `useWalletModal` for the
connect dialog (the dialog itself is mounted by `<WalletModalProvider>` in the
provider tree).

States:
- `connecting === true` → disabled pill with a spinner.
- `connected && publicKey` → connected pill that opens `WalletAccountModal`.
- otherwise → "Connect Solana" button calling `modal.setVisible(true)`.

Disconnect calls `wallet.disconnect().catch(() => {})` — the catch is
defensive; some adapters reject if the user has already manually disconnected
in their wallet UI.

### Address display

Both pills render the address through a `shorten` helper:
`addr.slice(0,5) + '…' + addr.slice(-4)`. Solana addresses are pulled with
`wallet.publicKey.toBase58()`.

## 8. WalletAccountModal

`components/bridge/wallet-account-modal.tsx` is shared between both VMs.
Props are flat strings — `address: string`, `chainKey: ActiveChainKey`,
`onDisconnect: () => void | Promise<void>` — so it doesn't depend on either
wallet library. It reads the native balance via `useTokenBalance(chainKey,
getNativeToken(chainKey))`, which routes EVM vs SVM under the hood.

Clipboard write is wrapped in try/catch — browsers without clipboard access
(insecure context, denied permission) just won't flip the "Copied!" label;
the modal still works.

For EVM, the `chainKey` passed in is derived from `chain.id` via
`getActiveChainByRelayId(chain.id)?.key ?? 'ethereum'`, so an EVM wallet
currently on Base shows the Base native balance, not Ethereum's.

## 9. Common edge cases

- **`mounted === false` SSR flicker** — RainbowKit's custom render prop
  returns `null` during SSR. Without the `mounted` check the EVM pill flashes
  in the disconnected state on first paint.
- **Same chain on both sides** — handled in `BridgeCard`, not in the wallet
  layer; the chain selector swaps when the user picks a duplicate.
- **`unsupported` EVM chain** — shows "Wrong network" pill that triggers
  RainbowKit's chain modal. Without this the swap step would just fail with a
  cryptic provider error.
- **No wallet installed** — RainbowKit's connect modal links to wallet
  download pages; the Solana modal lists detected adapters. Nothing for us to
  handle.
- **Hard refresh during a swap** — both stacks `autoConnect`, but the
  in-flight swap state (`progress`, `progressOpen` in `BridgeCard`) is local
  React state and is lost. The on-chain swap continues independently;
  recovery would require a future "recent swaps" feature reading from
  `/intents/status/v3` by stored `requestId`.

## 10. Environment variables

All wallet-relevant env vars are `NEXT_PUBLIC_` so they're inlined into the
client bundle:

| Var                            | Used by                  | Required?           |
|--------------------------------|--------------------------|---------------------|
| `NEXT_PUBLIC_WC_PROJECT_ID`    | wagmi / RainbowKit       | Strongly recommended; without it WalletConnect-based wallets (mobile) won't work. |
| `NEXT_PUBLIC_ALCHEMY_API_KEY`  | EVM RPC URLs             | Recommended for rate limits; public RPCs are used as fallback. |
| `NEXT_PUBLIC_HELIUS_API_KEY`   | Solana RPC URL           | Recommended for reliability; mainnet-beta is used as fallback. |
| `NEXT_PUBLIC_RELAY_API_KEY`    | Relay HTTP client        | Optional; sent as `Authorization: Bearer` if present. |
| `NEXT_PUBLIC_LOGO_DEV_API_KEY` | Token icon fallback      | Optional. |

Names are exported as string constants in `config/chain_info.ts`,
`config/relay_config.ts`, and `config/ui_config.ts` — never hard-coded at
read-sites.
