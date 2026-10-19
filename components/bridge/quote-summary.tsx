'use client';

import { Clock, Zap, Shield, Loader2, AlertTriangle } from 'lucide-react';
import type { BridgeProviderId, BridgeQuoteState } from '@/lib/bridge/types';
import {
  BRIDGE_PROVIDER_COPY,
  BRIDGE_BUTTON_COPY,
  QUOTE_DEFAULT_ETA_LABEL,
  QUOTE_FEE_LABEL_BPS_FALLBACK,
} from '@/config/ui_config';
import { RELAY_APP_FEE_BPS } from '@/config/relay_config';
import { NTT_REFERRER_FEE_BPS } from '@/config/ntt_config';

const fmtEta = (seconds?: number): string => {
  if (!seconds || seconds <= 0) return QUOTE_DEFAULT_ETA_LABEL;
  if (seconds < 60) return `~${seconds}s`;
  const mins = Math.round(seconds / 60);
  return `~${mins} min`;
};

// Shown before the first quote arrives; afterwards the quote's own label wins.
const defaultFeeLabel = (provider: BridgeProviderId): string => {
  const bps = provider === 'ntt' ? NTT_REFERRER_FEE_BPS : RELAY_APP_FEE_BPS;
  const pct = bps / 100;
  if (!Number.isFinite(pct)) return QUOTE_FEE_LABEL_BPS_FALLBACK;
  return `${pct}% fee`;
};

export function QuoteSummary({
  state,
  providerId,
}: {
  state: BridgeQuoteState;
  providerId: BridgeProviderId;
}) {
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
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-primary" />
            <span className="font-medium">{quote?.feeLabel ?? defaultFeeLabel(providerId)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-primary" />
            <span className="font-medium">{fmtEta(quote?.timeEstimateSeconds)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-primary" />
          <span className="font-medium">{BRIDGE_PROVIDER_COPY[providerId].securedBy}</span>
        </div>
      </div>

      {state.kind === 'loading' && !quote && (
        <div className="glass-inner rounded-lg px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          {BRIDGE_BUTTON_COPY.fetchingQuote}
        </div>
      )}

      {state.kind === 'error' && (
        <div className="rounded-lg px-3 py-2 text-xs text-red-300 border border-red-400/30 bg-red-500/5 break-words">
          {state.message}
        </div>
      )}

      {quote?.warning && state.kind !== 'error' && (
        <div className="rounded-lg px-3 py-2 text-xs text-amber-200 border border-amber-400/30 bg-amber-500/5 flex items-start gap-2">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{quote.warning}</span>
        </div>
      )}

      {quote && quote.rows.length > 0 && (
        <div className="glass-inner rounded-lg px-3 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          {quote.rows.map((row) => (
            <div key={row.label} className="contents">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="text-right text-foreground tabular-nums break-all">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
