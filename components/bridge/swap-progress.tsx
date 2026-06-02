'use client';

import { CheckCircle2, XCircle, Loader2, ExternalLink, X } from 'lucide-react';
import type { RelayStatus, RelayStatusResponse } from '@/lib/relay/types';
import { STATUS_COPY } from '@/config/ui_config';
import {
  buildExplorerTxUrl,
  getActiveChainByRelayId,
  type ActiveChainKey,
} from '@/config/active_chains';

export type SwapProgressUiState =
  | { kind: 'awaiting' }
  | { kind: 'executing'; label: string }
  | { kind: 'polling'; status: RelayStatusResponse }
  | { kind: 'success'; status: RelayStatusResponse }
  | { kind: 'failure'; message: string; status?: RelayStatusResponse }
  | { kind: 'refunded'; status: RelayStatusResponse };

const STAGE_ORDER: RelayStatus[] = ['waiting', 'pending', 'submitted', 'success'];

const stageIndex = (s?: RelayStatus): number => {
  if (!s) return 0;
  const i = STAGE_ORDER.indexOf(s);
  return i === -1 ? 0 : i;
};

const renderStatusLabel = (s?: RelayStatus): { title: string; body: string } => {
  if (!s) return STATUS_COPY.awaiting;
  return STATUS_COPY[s] ?? STATUS_COPY.awaiting;
};

const renderExplorerLink = (
  hash: string | undefined,
  chainKey: ActiveChainKey | undefined,
  label: string
) => {
  if (!hash || !chainKey) return null;
  return (
    <a
      href={buildExplorerTxUrl(chainKey, hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      {label}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
};

export function SwapProgress({
  open,
  state,
  onClose,
}: {
  open: boolean;
  state: SwapProgressUiState;
  onClose: () => void;
}) {
  if (!open) return null;

  let status: RelayStatus | undefined;
  let executingLabel: string | undefined;
  let errorMessage: string | undefined;
  let statusResp: RelayStatusResponse | undefined;

  switch (state.kind) {
    case 'awaiting':
      break;
    case 'executing':
      executingLabel = state.label;
      break;
    case 'polling':
      status = state.status.status;
      statusResp = state.status;
      break;
    case 'success':
      status = 'success';
      statusResp = state.status;
      break;
    case 'failure':
      status = 'failure';
      errorMessage = state.message;
      statusResp = state.status;
      break;
    case 'refunded':
      status = 'refunded';
      statusResp = state.status;
      break;
  }

  const copy = executingLabel
    ? { title: 'Submitting', body: executingLabel }
    : renderStatusLabel(status);

  const idx = stageIndex(status);
  const isTerminal =
    state.kind === 'success' || state.kind === 'failure' || state.kind === 'refunded';
  const originChain = getActiveChainByRelayId(statusResp?.originChainId ?? 0);
  const destChain = getActiveChainByRelayId(statusResp?.destinationChainId ?? 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md glass-card rounded-2xl p-6 relative animate-in zoom-in-95 duration-150"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-4 mt-2">
          {state.kind === 'success' && <CheckCircle2 className="w-12 h-12 text-emerald-400" />}
          {state.kind === 'failure' && <XCircle className="w-12 h-12 text-red-400" />}
          {state.kind === 'refunded' && <XCircle className="w-12 h-12 text-amber-400" />}
          {(state.kind === 'awaiting' ||
            state.kind === 'executing' ||
            state.kind === 'polling') && (
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          )}

          <div className="text-center space-y-1">
            <h3 className="text-foreground text-lg font-semibold">{copy.title}</h3>
            <p className="text-muted-foreground text-sm">{copy.body}</p>
            {errorMessage && <p className="text-red-300 text-xs mt-2">{errorMessage}</p>}
          </div>

          <div className="w-full mt-2 flex items-center gap-2">
            {STAGE_ORDER.map((s, i) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  i <= idx ? 'bg-primary' : 'bg-white/10'
                }`}
                title={s}
              />
            ))}
          </div>

          <div className="w-full text-xs text-muted-foreground flex flex-col gap-1 mt-1">
            {statusResp?.inTxHashes?.[0] &&
              renderExplorerLink(
                statusResp.inTxHashes[0],
                originChain?.key,
                'Origin transaction'
              )}
            {statusResp?.txHashes?.[0] &&
              renderExplorerLink(
                statusResp.txHashes[0],
                destChain?.key,
                'Destination transaction'
              )}
          </div>

          {isTerminal && (
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-3 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer glass-button text-white"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
