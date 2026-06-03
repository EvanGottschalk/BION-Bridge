'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { ChainSelector } from './chain-selector';
import { TokenSelector } from './token-selector';
import { QuoteSummary } from './quote-summary';
import { SwapProgress, type SwapProgressUiState } from './swap-progress';
import { ACTIVE_CHAINS, getActiveChain, type ActiveChainKey } from '@/config/active_chains';
import { getNativeToken, type TokenInfo } from '@/config/token_info';
import { useRelayQuote } from '@/hooks/use-relay-quote';
import { useActiveWallet, useWalletForChain } from '@/lib/wallets/use-active-wallet';
import { useEvmSigner, useSvmSigner } from '@/lib/wallets/signers';
import { executeSteps } from '@/lib/relay/execute';
import { pollStatus } from '@/lib/relay/status';

const DEFAULT_FROM: ActiveChainKey = 'solana';
const DEFAULT_TO: ActiveChainKey = 'base';

export function BridgeCard() {
  const [fromChain, setFromChain] = useState<ActiveChainKey>(DEFAULT_FROM);
  const [toChain, setToChain] = useState<ActiveChainKey>(DEFAULT_TO);
  const [fromToken, setFromToken] = useState<TokenInfo | null>(() => getNativeToken(DEFAULT_FROM));
  const [toToken, setToToken] = useState<TokenInfo | null>(() => getNativeToken(DEFAULT_TO));
  const [amount, setAmount] = useState('');
  const [progress, setProgress] = useState<SwapProgressUiState>({ kind: 'awaiting' });
  const [progressOpen, setProgressOpen] = useState(false);

  const wallets = useActiveWallet();
  const originWallet = useWalletForChain(fromChain);
  const destWallet = useWalletForChain(toChain);
  const evmSigner = useEvmSigner();
  const svmSigner = useSvmSigner();

  useEffect(() => {
    if (fromToken && !ACTIVE_CHAINS.find((c) => c.key === fromChain)) return;
    setFromToken((prev) => prev ?? getNativeToken(fromChain));
  }, [fromChain, fromToken]);

  useEffect(() => {
    if (toToken && !ACTIVE_CHAINS.find((c) => c.key === toChain)) return;
    setToToken((prev) => prev ?? getNativeToken(toChain));
  }, [toChain, toToken]);

  const onChainFromChange = (next: ActiveChainKey) => {
    if (next === toChain) setToChain(fromChain);
    setFromChain(next);
    setFromToken(getNativeToken(next));
  };

  const onChainToChange = (next: ActiveChainKey) => {
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

  const quoteState = useRelayQuote({
    fromChain,
    toChain,
    fromToken: fromToken ?? undefined,
    toToken: toToken ?? undefined,
    amount,
    user: originWallet.address,
    recipient: destWallet.address,
  });

  const buttonState = useMemo<{ label: string; disabled: boolean; action: 'connect' | 'swap' }>(() => {
    if (!originWallet.isConnected) {
      const vm = getActiveChain(fromChain).vmType;
      return {
        label: vm === 'svm' ? 'Connect Solana wallet' : 'Connect EVM wallet',
        disabled: false,
        action: 'connect',
      };
    }
    if (!destWallet.isConnected && getActiveChain(toChain).vmType !== getActiveChain(fromChain).vmType) {
      const vm = getActiveChain(toChain).vmType;
      return {
        label: vm === 'svm' ? 'Connect Solana wallet' : 'Connect EVM wallet',
        disabled: false,
        action: 'connect',
      };
    }
    if (!fromToken || !toToken) return { label: 'Select tokens', disabled: true, action: 'swap' };
    if (!amount || Number(amount) <= 0) return { label: 'Enter amount', disabled: true, action: 'swap' };
    if (quoteState.kind === 'loading') return { label: 'Fetching quote…', disabled: true, action: 'swap' };
    if (quoteState.kind === 'error') return { label: 'Quote failed', disabled: true, action: 'swap' };
    if (quoteState.kind !== 'ready') return { label: 'Awaiting quote', disabled: true, action: 'swap' };
    return {
      label: `Swap ${fromToken.symbol} → ${toToken.symbol}`,
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
    quoteState.kind,
  ]);

  const handleSwap = async () => {
    if (quoteState.kind !== 'ready') return;
    setProgressOpen(true);
    setProgress({ kind: 'executing', label: 'Confirm the transactions in your wallet.' });
    try {
      const result = await executeSteps(quoteState.quote.raw.steps, {
        evm: evmSigner,
        svm: svmSigner,
        originChainId: getActiveChain(fromChain).relayChainId,
        destinationChainId: getActiveChain(toChain).relayChainId,
        onProgress: (p) => {
          if (p.kind === 'tx-sent') {
            setProgress({
              kind: 'executing',
              label: 'Transaction broadcast. Waiting for solver…',
            });
          } else if (p.kind === 'sig-sent') {
            setProgress({ kind: 'executing', label: 'Signature submitted.' });
          }
        },
      });

      const requestId = result.requestId || quoteState.quote.requestIds[0];
      if (!requestId) {
        setProgress({ kind: 'failure', message: 'Could not find a requestId to poll.' });
        return;
      }

      const final = await pollStatus(requestId, {
        onUpdate: (s) => {
          setProgress({ kind: 'polling', status: s });
        },
      });

      if (final.status === 'success') setProgress({ kind: 'success', status: final });
      else if (final.status === 'refunded' || final.status === 'refund')
        setProgress({ kind: 'refunded', status: final });
      else setProgress({ kind: 'failure', message: final.details ?? 'Swap failed', status: final });
    } catch (err) {
      const msg = (err as Error).message || 'Unknown error';
      setProgress({ kind: 'failure', message: msg });
    }
  };

  const onButtonClick = () => {
    if (buttonState.disabled) return;
    if (buttonState.action === 'connect') {
      // ConnectButton in header is the primary entry point. Surface a hint by
      // briefly opening the swap modal? Instead we no-op; user clicks header.
      return;
    }
    handleSwap();
  };

  const outputDisplay =
    quoteState.kind === 'ready'
      ? quoteState.quote.outputAmountFormatted
      : quoteState.kind === 'loading' && quoteState.previous
        ? quoteState.previous.outputAmountFormatted
        : '0';

  const isBridging =
    progressOpen &&
    (progress.kind === 'awaiting' || progress.kind === 'executing' || progress.kind === 'polling');

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative glass-card rounded-2xl overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-px bg-primary shadow-[0_0_30px_8px_rgba(74,108,247,0.25)]" />

        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-foreground text-lg font-semibold">Bridge</h2>
              <div className="px-2 py-0.5 glass-panel rounded-md text-primary text-[10px] font-medium uppercase tracking-wider">
                Live
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Operational
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-stretch gap-3">
            <div className="flex-1 glass-panel rounded-xl p-4 space-y-4">
              <ChainSelector label="From" selectedChain={fromChain} onSelect={onChainFromChange} />
              <TokenSelector
                label="Token"
                chain={fromChain}
                selected={fromToken}
                onSelect={setFromToken}
              />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Amount
                  </span>
                </div>
                <div className="flex items-center gap-3 glass-inner rounded-lg px-4 py-3 focus-within:border-primary/40 transition-colors">
                  <input
                    inputMode="decimal"
                    type="text"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/,/g, '.');
                      if (v === '' || /^\d*(?:\.\d*)?$/.test(v)) setAmount(v);
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
                aria-label="Swap chains"
              >
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors md:rotate-0 rotate-90" />
              </button>
            </div>

            <div className="flex-1 glass-panel rounded-xl p-4 space-y-4">
              <ChainSelector label="To" selectedChain={toChain} onSelect={onChainToChange} />
              <TokenSelector
                label="Token"
                chain={toChain}
                selected={toToken}
                onSelect={setToToken}
              />
              <div>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-2">
                  You Receive
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
            </div>
          </div>

          <QuoteSummary state={quoteState} />

          <button
            type="button"
            onClick={onButtonClick}
            disabled={buttonState.disabled || isBridging}
            className="w-full mt-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 glass-button text-white hover:shadow-[0_0_40px_rgba(74,108,247,0.35)] active:scale-[0.98]"
          >
            {isBridging ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Bridging…
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
        onClose={() => {
          if (
            progress.kind === 'success' ||
            progress.kind === 'failure' ||
            progress.kind === 'refunded'
          ) {
            setProgressOpen(false);
            setProgress({ kind: 'awaiting' });
          } else {
            // Don't allow closing mid-flight.
            setProgressOpen(false);
          }
        }}
      />
    </div>
  );
}
