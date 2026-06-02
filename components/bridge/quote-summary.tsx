'use client';

import { Clock, Zap, Shield, Loader2 } from 'lucide-react';
import type { QuoteState } from '@/hooks/use-relay-quote';
import { QUOTE_DEFAULT_ETA_LABEL, QUOTE_FEE_LABEL_BPS_FALLBACK } from '@/config/ui_config';
import { RELAY_APP_FEE_BPS } from '@/config/relay_config';

const fmtUsd = (v?: string): string | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (Number.isNaN(n)) return undefined;
  if (n < 0.01) return '<$0.01';
  return `$${n.toFixed(2)}`;
};

const fmtEta = (seconds?: number): string => {
  if (!seconds || seconds <= 0) return QUOTE_DEFAULT_ETA_LABEL;
  if (seconds < 60) return `~${seconds}s`;
  const mins = Math.round(seconds / 60);
  return `~${mins} min`;
};

const feeLabel = (): string => {
  const pct = RELAY_APP_FEE_BPS / 100;
  if (!Number.isFinite(pct)) return QUOTE_FEE_LABEL_BPS_FALLBACK;
  return `${pct}% fee`;
};

export function QuoteSummary({ state }: { state: QuoteState }) {
  const quote =
    state.kind === 'ready'
      ? state.quote
      : state.kind === 'loading'
        ? state.previous
        : state.kind === 'error'
          ? state.previous
          : undefined;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-primary" />
            <span className="font-medium">{feeLabel()}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-primary" />
            <span className="font-medium">{fmtEta(quote?.timeEstimateSeconds)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-primary" />
          <span className="font-medium">Secured by Relay</span>
        </div>
      </div>

      {state.kind === 'loading' && !quote && (
        <div className="glass-inner rounded-lg px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Fetching quote…
        </div>
      )}

      {state.kind === 'error' && (
        <div className="rounded-lg px-3 py-2 text-xs text-red-300 border border-red-400/30 bg-red-500/5">
          {state.message}
        </div>
      )}

      {quote && (
        <div className="glass-inner rounded-lg px-3 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          {quote.rate && (
            <>
              <span className="text-muted-foreground">Rate</span>
              <span className="text-right text-foreground tabular-nums">{quote.rate}</span>
            </>
          )}
          {fmtUsd(quote.outputAmountUsd) && (
            <>
              <span className="text-muted-foreground">Output value</span>
              <span className="text-right text-foreground tabular-nums">
                {fmtUsd(quote.outputAmountUsd)}
              </span>
            </>
          )}
          {fmtUsd(quote.feeBreakdownUsd.gas) && (
            <>
              <span className="text-muted-foreground">Gas</span>
              <span className="text-right text-foreground tabular-nums">
                {fmtUsd(quote.feeBreakdownUsd.gas)}
              </span>
            </>
          )}
          {fmtUsd(quote.feeBreakdownUsd.relayerService) && (
            <>
              <span className="text-muted-foreground">Relayer fee</span>
              <span className="text-right text-foreground tabular-nums">
                {fmtUsd(quote.feeBreakdownUsd.relayerService)}
              </span>
            </>
          )}
          {fmtUsd(quote.feeBreakdownUsd.app) && (
            <>
              <span className="text-muted-foreground">App fee</span>
              <span className="text-right text-foreground tabular-nums">
                {fmtUsd(quote.feeBreakdownUsd.app)}
              </span>
            </>
          )}
          {quote.feeBreakdownUsd.totalImpactPercent && (
            <>
              <span className="text-muted-foreground">Price impact</span>
              <span className="text-right text-foreground tabular-nums">
                {quote.feeBreakdownUsd.totalImpactPercent}%
              </span>
            </>
          )}
          {quote.slippagePercent && (
            <>
              <span className="text-muted-foreground">Slippage</span>
              <span className="text-right text-foreground tabular-nums">
                {quote.slippagePercent}%
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
