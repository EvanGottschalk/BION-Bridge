'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { ChainSelector } from './chain-selector';
import { TokenSelector } from './token-selector';
import { QuoteSummary } from './quote-summary';
import { SwapProgress } from './swap-progress';
import { NttRedeemPanel } from './ntt-redeem-panel';
import { Switch } from '@/components/ui/switch';
import { getActiveChain, getDefaultChainPair, type ActiveChainKey } from '@/config/active_chains';
import { getNativeToken, type TokenInfo } from '@/config/token_info';
import {
  BRIDGE_BUTTON_COPY,
  BRIDGE_CARD_COPY,
  NTT_REDEEM_COPY,
  NTT_STATUS_COPY,
  STATUS_COPY,
  SWAP_PROGRESS_COPY,
  TEST_MODE_COPY,
} from '@/config/ui_config';
import { NTT_TRIMMED_DECIMALS } from '@/config/ntt_config';
import { useBridgeQuote } from '@/hooks/use-bridge-quote';
import { useTokenBalance } from '@/hooks/use-token-balance';
import { useActiveChains, useNetworkMode } from '@/lib/network/network-mode';
import { useActiveWallet, useWalletForChain } from '@/lib/wallets/use-active-wallet';
import { useEvmSigner, useSvmSigner } from '@/lib/wallets/signers';
import { loadProvider } from '@/lib/bridge/router';
import {
  isTerminalProgress,
  type BridgeProgress,
  type BridgeProvider,
  type BridgeReceipt,
  type BridgeSigners,
} from '@/lib/bridge/types';
import {
  findNttChainEntry,
  getNttChains,
  getNttTokenInfo,
  isNttToken,
} from '@/lib/ntt/registry';
import { listPendingNtt } from '@/lib/ntt/pending';
import { toBaseUnits } from '@/lib/relay/quote';

type Flight = { provider: BridgeProvider; receipt: BridgeReceipt };

const errorMessage = (err: unknown): string =>
  (err as Error)?.message || SWAP_PROGRESS_COPY.unknownError;

const failureProgress = (err: unknown): BridgeProgress => ({
  kind: 'failure',
  copy: STATUS_COPY.failure,
  message: errorMessage(err),
  links: [],
});

const amountPattern = (maxDecimals: number): RegExp =>
  maxDecimals > 0 ? new RegExp(`^\\d*(?:\\.\\d{0,${maxDecimals}})?$`) : /^\d*$/;

const truncateDecimals = (value: string, maxDecimals: number): string => {
  const [whole, frac] = value.split('.');
  if (frac === undefined || frac.length <= maxDecimals) return value;
  return maxDecimals > 0 ? `${whole}.${frac.slice(0, maxDecimals)}` : whole;
};

export function BridgeCard() {
  const { testMode, setTestMode, toggleVisible } = useNetworkMode();
  const chains = useActiveChains();
  const initialPair = getDefaultChainPair(testMode);

  const [fromChain, setFromChain] = useState<ActiveChainKey>(initialPair.from);
  const [toChain, setToChain] = useState<ActiveChainKey>(initialPair.to);
  const [fromToken, setFromToken] = useState<TokenInfo | null>(() => getNativeToken(initialPair.from));
  const [toToken, setToToken] = useState<TokenInfo | null>(() => getNativeToken(initialPair.to));
  const [amount, setAmount] = useState('');
  const [progress, setProgress] = useState<BridgeProgress>({ kind: 'awaiting' });
  const [progressOpen, setProgressOpen] = useState(false);
  const [busy, setBusy] = useState(false); // executing or tracking
  const [redeeming, setRedeeming] = useState(false);
  const flightRef = useRef<Flight | null>(null);

  const wallets = useActiveWallet();
  const originWallet = useWalletForChain(fromChain);
  const destWallet = useWalletForChain(toChain);
  const evmSigner = useEvmSigner();
  const svmSigner = useSvmSigner();
  const signers = useMemo<BridgeSigners>(
    () => ({
      evm: evmSigner,
      svm: svmSigner,
      evmAddress: wallets.evm.address,
      svmAddress: wallets.svm.address,
    }),
    [evmSigner, svmSigner, wallets.evm.address, wallets.svm.address]
  );

  // Flipping Test Mode resets the card to that mode's defaults.
  const modeRef = useRef(testMode);
  useEffect(() => {
    if (modeRef.current === testMode) return;
    modeRef.current = testMode;
    const pair = getDefaultChainPair(testMode);
    setFromChain(pair.from);
    setToChain(pair.to);
    setFromToken(getNativeToken(pair.from));
    setToToken(getNativeToken(pair.to));
    setAmount('');
  }, [testMode]);

  // ---- NTT pairing: an NTT token on the From side dictates the To side ----
  const fromNtt = findNttChainEntry(fromChain, fromToken?.address);
  const nttSymbol = fromNtt?.symbol;
  const allowedToChains = useMemo(
    () => (nttSymbol ? getNttChains(nttSymbol).filter((k) => k !== fromChain) : undefined),
    [nttSymbol, fromChain]
  );
  const inMode = useCallback((k: ActiveChainKey) => chains.some((c) => c.key === k), [chains]);

  // Peer chain + token for an NTT token anchored on `anchor`, preferring `preferred`.
  const nttPeer = useCallback(
    (symbol: string, anchor: ActiveChainKey, preferred: ActiveChainKey) => {
      const peers = getNttChains(symbol).filter((k) => k !== anchor && inMode(k));
      const chain = peers.includes(preferred) ? preferred : peers[0];
      const token = chain ? getNttTokenInfo(chain, symbol) : undefined;
      return chain && token ? { chain, token } : undefined;
    },
    [inMode]
  );

  const onFromTokenSelect = (t: TokenInfo) => {
    setFromToken(t);
    const match = findNttChainEntry(fromChain, t.address);
    if (match) {
      const peer = nttPeer(match.symbol, fromChain, toChain);
      if (peer) {
        setToChain(peer.chain);
        setToToken(peer.token);
      }
    } else if (toToken && isNttToken(toChain, toToken.address)) {
      setToToken(getNativeToken(toChain)); // leaving NTT releases the lock
    }
  };

  const onToTokenSelect = (t: TokenInfo) => {
    setToToken(t);
    const match = findNttChainEntry(toChain, t.address);
    if (match) {
      const peer = nttPeer(match.symbol, toChain, fromChain);
      if (peer) {
        setFromChain(peer.chain);
        setFromToken(peer.token);
      }
    }
  };

  const onChainFromChange = (next: ActiveChainKey) => {
    const nextTo = next === toChain ? fromChain : toChain;
    if (next === toChain) setToChain(fromChain);
    setFromChain(next);
    setFromToken(getNativeToken(next));
    if (toToken && isNttToken(toChain, toToken.address)) setToToken(getNativeToken(nextTo));
  };

  const onChainToChange = (next: ActiveChainKey) => {
    if (nttSymbol) {
      const token = getNttTokenInfo(next, nttSymbol);
      if (!token) return;
      setToChain(next);
      setToToken(token);
      return;
    }
    if (next === fromChain) setFromChain(toChain);
    setToChain(next);
    setToToken(getNativeToken(next));
  };

  const swapSides = () => {
    setFromChain(toChain);
    setToChain(fromChain);
    setFromToken(toToken);
    setToToken(fromToken);
  };

  // ---- Amount precision: NTT trims to 8 decimals on the wire ----
  const maxDecimals = useMemo(() => {
    const decimals = fromToken?.decimals ?? 18;
    return fromNtt ? Math.min(NTT_TRIMMED_DECIMALS, decimals) : decimals;
  }, [fromToken?.decimals, fromNtt]);

  useEffect(() => {
    setAmount((a) => truncateDecimals(a, maxDecimals));
  }, [maxDecimals]);

  // ---- Quote ----
  const { state: quoteState, providerId } = useBridgeQuote({
    fromChain,
    toChain,
    fromToken: fromToken ?? undefined,
    toToken: toToken ?? undefined,
    amount,
    user: originWallet.address,
    recipient: destWallet.address,
  });

  const fromBalance = useTokenBalance(fromChain, fromToken);
  const nativeBalance = useTokenBalance(fromChain, getNativeToken(fromChain));

  const amountUnits = useMemo(() => {
    if (!fromToken || !amount) return 0n;
    try {
      return toBaseUnits(amount, fromToken.decimals ?? 18);
    } catch {
      return 0n;
    }
  }, [amount, fromToken]);

  const insufficientBalance =
    fromBalance.raw !== null && !fromBalance.loading && amountUnits > fromBalance.raw;

  const requiredNative = quoteState.kind === 'ready' ? quoteState.quote.requiredNativeRaw : undefined;
  const fromIsNative = fromToken?.address === getNativeToken(fromChain).address;
  const insufficientGas =
    requiredNative !== undefined &&
    nativeBalance.raw !== null &&
    !nativeBalance.loading &&
    nativeBalance.raw < requiredNative + (fromIsNative ? amountUnits : 0n);

  const buttonState = useMemo<{ label: string; disabled: boolean; action: 'connect' | 'swap' }>(() => {
    const connectLabel = (chain: ActiveChainKey) =>
      getActiveChain(chain).vmType === 'svm'
        ? BRIDGE_BUTTON_COPY.connectSolana
        : BRIDGE_BUTTON_COPY.connectEvm;
    if (!originWallet.isConnected) {
      return { label: connectLabel(fromChain), disabled: false, action: 'connect' };
    }
    if (!destWallet.isConnected && getActiveChain(toChain).vmType !== getActiveChain(fromChain).vmType) {
      return { label: connectLabel(toChain), disabled: false, action: 'connect' };
    }
    if (!fromToken || !toToken) return { label: BRIDGE_BUTTON_COPY.selectTokens, disabled: true, action: 'swap' };
    if (!amount || Number(amount) <= 0) return { label: BRIDGE_BUTTON_COPY.enterAmount, disabled: true, action: 'swap' };
    if (insufficientBalance) return { label: BRIDGE_BUTTON_COPY.insufficientBalance, disabled: true, action: 'swap' };
    if (quoteState.kind === 'loading') return { label: BRIDGE_BUTTON_COPY.fetchingQuote, disabled: true, action: 'swap' };
    if (quoteState.kind === 'error') {
      return {
        label: quoteState.code === 'capacity' ? BRIDGE_BUTTON_COPY.exceedsCapacity : BRIDGE_BUTTON_COPY.quoteFailed,
        disabled: true,
        action: 'swap',
      };
    }
    if (quoteState.kind !== 'ready') return { label: BRIDGE_BUTTON_COPY.awaitingQuote, disabled: true, action: 'swap' };
    if (insufficientGas) return { label: BRIDGE_BUTTON_COPY.insufficientGas, disabled: true, action: 'swap' };
    return {
      label:
        providerId === 'ntt'
          ? BRIDGE_BUTTON_COPY.bridge(fromToken.symbol)
          : BRIDGE_BUTTON_COPY.swap(fromToken.symbol, toToken.symbol),
      disabled: false,
      action: 'swap',
    };
  }, [
    originWallet.isConnected,
    destWallet.isConnected,
    fromChain,
    toChain,
    fromToken,
    toToken,
    amount,
    insufficientBalance,
    insufficientGas,
    quoteState,
    providerId,
  ]);

  // ---- Execution + tracking ----
  const runTrack = useCallback(async (flight: Flight) => {
    flightRef.current = flight;
    setBusy(true);
    try {
      const final = await flight.provider.track(flight.receipt, setProgress);
      setProgress(final);
    } catch (err) {
      setProgress(failureProgress(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const handleSwap = async () => {
    if (quoteState.kind !== 'ready') return;
    const quote = quoteState.quote;
    setProgressOpen(true);
    setProgress({ kind: 'executing', label: SWAP_PROGRESS_COPY.confirmInWallet });
    setBusy(true);
    let flight: Flight;
    try {
      const provider = await loadProvider(quote.provider);
      const receipt = await provider.execute(quote, signers, setProgress);
      flight = { provider, receipt };
    } catch (err) {
      setProgress(failureProgress(err));
      setBusy(false);
      return;
    }
    await runTrack(flight);
  };

  const [redeemError, setRedeemError] = useState<string | undefined>();
  const handleRedeem = async () => {
    const flight = flightRef.current;
    if (!flight?.provider.redeem) return;
    setRedeeming(true);
    setRedeemError(undefined);
    try {
      await flight.provider.redeem(flight.receipt, signers, setProgress);
      if (!busy) void runTrack(flight); // tracking had already stopped; pick it back up
    } catch (err) {
      setRedeemError(errorMessage(err));
    } finally {
      setRedeeming(false);
    }
  };

  // Resume NTT transfers started in an earlier session (per viewer, per mode).
  useEffect(() => {
    if (flightRef.current) return;
    const pending = listPendingNtt(testMode ? 'Testnet' : 'Mainnet');
    if (!pending.length) return;
    const latest = [...pending].sort((a, b) => b.startedAt - a.startedAt)[0];
    let cancelled = false;
    (async () => {
      const provider = await loadProvider('ntt');
      if (cancelled || !provider.resume || flightRef.current) return;
      const receipt = await provider.resume(latest);
      if (cancelled) return;
      setProgressOpen(true);
      setProgress({ kind: 'tracking', stage: 0, copy: NTT_STATUS_COPY.sourceInitiated, links: [] });
      await runTrack({ provider, receipt });
    })().catch(() => {
      // A broken record just doesn't resume.
    });
    return () => {
      cancelled = true;
    };
  }, [testMode, runTrack]);

  // Destination-side redeem for a sent-but-undelivered NTT transfer.
  const network = testMode ? 'Testnet' : 'Mainnet';
  const latestPendingTxid = useMemo(() => {
    if (!nttSymbol) return undefined;
    return listPendingNtt(network)
      .filter((p) => p.symbol === nttSymbol && p.fromChain === fromChain && p.toChain === toChain)
      .sort((a, b) => b.startedAt - a.startedAt)[0]?.txid;
    // `busy` re-reads storage after a transfer starts or finishes.
  }, [nttSymbol, network, fromChain, toChain, busy]);

  const handleRedeemByTx = async (txid: string) => {
    if (!nttSymbol || busy) return;
    setProgressOpen(true);
    setRedeemError(undefined);
    setProgress({ kind: 'executing', label: NTT_REDEEM_COPY.lookingUp });
    setBusy(true);
    let flight: Flight;
    try {
      const provider = await loadProvider('ntt');
      if (!provider.redeemByTx) throw new Error(SWAP_PROGRESS_COPY.unknownError);
      const receipt = await provider.redeemByTx(
        { symbol: nttSymbol, network, fromChain, toChain, txid, startedAt: Date.now() },
        signers,
        setProgress
      );
      flight = { provider, receipt };
    } catch (err) {
      setProgress(failureProgress(err));
      setBusy(false);
      return;
    }
    await runTrack(flight);
  };

  const onButtonClick = () => {
    if (busy) {
      setProgressOpen(true); // reopen the progress modal for the in-flight transfer
      return;
    }
    if (buttonState.disabled) return;
    if (buttonState.action === 'connect') {
      // ConnectButton in header is the primary entry point; the label is a cue.
      return;
    }
    handleSwap();
  };

  const onCloseProgress = () => {
    setProgressOpen(false);
    if (isTerminalProgress(progress)) {
      setProgress({ kind: 'awaiting' });
      setRedeemError(undefined);
      flightRef.current = null;
    }
  };

  const outputDisplay =
    quoteState.kind === 'ready'
      ? quoteState.quote.outputAmountFormatted
      : quoteState.kind === 'loading' && quoteState.previous
        ? quoteState.previous.outputAmountFormatted
        : '0';

  const showPhantomHint =
    testMode &&
    (getActiveChain(fromChain).vmType === 'svm' || getActiveChain(toChain).vmType === 'svm');

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative glass-card rounded-2xl overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-px bg-primary shadow-[0_0_30px_8px_rgba(74,108,247,0.25)]" />

        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-foreground text-lg font-semibold">{BRIDGE_CARD_COPY.title}</h2>
              <div
                className={`px-2 py-0.5 glass-panel rounded-md text-[10px] font-medium uppercase tracking-wider ${
                  testMode ? 'text-amber-300 border border-amber-400/30' : 'text-primary'
                }`}
              >
                {testMode ? TEST_MODE_COPY.testnetBadge : TEST_MODE_COPY.liveBadge}
              </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              {toggleVisible && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <span className="font-medium">{TEST_MODE_COPY.label}</span>
                  <Switch
                    checked={testMode}
                    onCheckedChange={setTestMode}
                    disabled={busy}
                    aria-label={TEST_MODE_COPY.label}
                    className="data-[state=checked]:bg-amber-400"
                  />
                  <span
                    className={`w-6 font-semibold tabular-nums ${testMode ? 'text-amber-300' : ''}`}
                  >
                    {testMode ? TEST_MODE_COPY.on : TEST_MODE_COPY.off}
                  </span>
                </label>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {TEST_MODE_COPY.operational}
              </div>
            </div>
          </div>

          {showPhantomHint && (
            <p className="-mt-2 mb-4 text-[11px] text-amber-200/80">{TEST_MODE_COPY.phantomHint}</p>
          )}

          <div className="flex flex-col md:flex-row items-stretch gap-3">
            <div className="flex-1 min-w-0 glass-panel rounded-xl p-4 space-y-4">
              <ChainSelector
                label={BRIDGE_CARD_COPY.fromLabel}
                chains={chains}
                selectedChain={fromChain}
                onSelect={onChainFromChange}
              />
              <TokenSelector
                label={BRIDGE_CARD_COPY.tokenLabel}
                chain={fromChain}
                selected={fromToken}
                onSelect={onFromTokenSelect}
              />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {BRIDGE_CARD_COPY.amountLabel}
                  </span>
                  {fromBalance.formatted !== null && (
                    <span className="text-[11px] text-muted-foreground tabular-nums truncate ml-2">
                      {fromBalance.formatted} {fromToken?.symbol ?? ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 glass-inner rounded-lg px-4 py-3 focus-within:border-primary/40 transition-colors">
                  <input
                    inputMode="decimal"
                    type="text"
                    placeholder={BRIDGE_CARD_COPY.amountPlaceholder}
                    value={amount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/,/g, '.');
                      if (v === '' || amountPattern(maxDecimals).test(v)) setAmount(v);
                    }}
                    className="flex-1 bg-transparent text-foreground text-lg font-medium outline-none placeholder:text-muted-foreground/40 min-w-0"
                  />
                  <span className="text-sm text-muted-foreground font-medium">
                    {fromToken?.symbol ?? ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center md:self-center">
              <button
                type="button"
                onClick={swapSides}
                className="w-10 h-10 rounded-xl glass-card border border-white/10 flex items-center justify-center hover:border-primary/50 transition-all duration-200 cursor-pointer group"
                aria-label={BRIDGE_CARD_COPY.swapSidesAria}
              >
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors md:rotate-0 rotate-90" />
              </button>
            </div>

            <div className="flex-1 min-w-0 glass-panel rounded-xl p-4 space-y-4">
              <ChainSelector
                label={BRIDGE_CARD_COPY.toLabel}
                chains={chains}
                selectedChain={toChain}
                onSelect={onChainToChange}
                allowedChains={allowedToChains}
              />
              <TokenSelector
                label={BRIDGE_CARD_COPY.tokenLabel}
                chain={toChain}
                selected={toToken}
                onSelect={onToTokenSelect}
                locked={Boolean(nttSymbol)}
              />
              <div>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-2">
                  {BRIDGE_CARD_COPY.receiveLabel}
                </span>
                <div className="flex items-center gap-3 glass-inner rounded-lg px-4 py-3 min-h-[52px]">
                  <span className="flex-1 text-foreground text-lg font-medium tabular-nums truncate">
                    {outputDisplay}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">
                    {toToken?.symbol ?? ''}
                  </span>
                </div>
              </div>
              {nttSymbol && (
                <NttRedeemPanel
                  fromChain={fromChain}
                  toChain={toChain}
                  defaultTxid={latestPendingTxid}
                  destConnected={destWallet.isConnected}
                  busy={busy}
                  onRedeem={handleRedeemByTx}
                />
              )}
            </div>
          </div>

          <QuoteSummary state={quoteState} providerId={providerId} />

          <button
            type="button"
            onClick={onButtonClick}
            disabled={!busy && buttonState.disabled}
            className="w-full mt-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 glass-button text-white hover:shadow-[0_0_40px_rgba(74,108,247,0.35)] active:scale-[0.98]"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {BRIDGE_CARD_COPY.bridging}
              </span>
            ) : (
              buttonState.label
            )}
          </button>
        </div>
      </div>

      <SwapProgress
        open={progressOpen}
        state={progress}
        onClose={onCloseProgress}
        onRedeem={handleRedeem}
        redeeming={redeeming}
        redeemError={redeemError}
      />
    </div>
  );
}
