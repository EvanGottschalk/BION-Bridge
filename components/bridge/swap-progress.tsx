'use client';

import { CheckCircle2, XCircle, Loader2, ExternalLink, X } from 'lucide-react';
import type { BridgeLink, BridgeProgress } from '@/lib/bridge/types';
import { STATUS_COPY, SWAP_PROGRESS_COPY } from '@/config/ui_config';

const STAGE_COUNT = 4;

const renderLink = (link: BridgeLink) => (
  <a
    key={link.href}
    href={link.href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
  >
    {link.label}
    <ExternalLink className="w-3 h-3" />
  </a>
);

export function SwapProgress({
  open,
  state,
  onClose,
  onRedeem,
  redeeming,
  redeemError,
}: {
  open: boolean;
  state: BridgeProgress;
  onClose: () => void;
  onRedeem?: () => void;
  redeeming?: boolean;
  redeemError?: string;
}) {
  if (!open) return null;

  let copy = STATUS_COPY.awaiting;
  let stage = 0;
  let links: BridgeLink[] = [];
  let note: string | undefined;
  let errorMessage: string | undefined;
  let canRedeem = false;

  switch (state.kind) {
    case 'awaiting':
      break;
    case 'executing':
      copy = { title: SWAP_PROGRESS_COPY.submittingTitle, body: state.label };
      break;
    case 'tracking':
      copy = state.copy;
      stage = state.stage;
      links = state.links;
      note = state.note;
      canRedeem = Boolean(state.canRedeem);
      break;
    case 'success':
      copy = state.copy;
      stage = STAGE_COUNT - 1;
      links = state.links;
      break;
    case 'refunded':
      copy = state.copy;
      links = state.links;
      break;
    case 'failure':
      copy = state.copy;
      links = state.links;
      errorMessage = state.message;
      canRedeem = Boolean(state.canRedeem);
      break;
  }

  const isTerminal =
    state.kind === 'success' || state.kind === 'failure' || state.kind === 'refunded';

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
          aria-label={SWAP_PROGRESS_COPY.close}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-4 mt-2">
          {state.kind === 'success' && <CheckCircle2 className="w-12 h-12 text-emerald-400" />}
          {state.kind === 'failure' && <XCircle className="w-12 h-12 text-red-400" />}
          {state.kind === 'refunded' && <XCircle className="w-12 h-12 text-amber-400" />}
          {(state.kind === 'awaiting' ||
            state.kind === 'executing' ||
            state.kind === 'tracking') && (
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          )}

          <div className="text-center space-y-1">
            <h3 className="text-foreground text-lg font-semibold">{copy.title}</h3>
            <p className="text-muted-foreground text-sm">{copy.body}</p>
            {errorMessage && <p className="text-red-300 text-xs mt-2 break-words">{errorMessage}</p>}
          </div>

          <div className="w-full mt-2 flex items-center gap-2">
            {Array.from({ length: STAGE_COUNT }, (_, i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  state.kind !== 'awaiting' && state.kind !== 'executing' && i <= stage
                    ? 'bg-primary'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          {links.length > 0 && (
            <div className="w-full text-xs text-muted-foreground flex flex-col gap-1 mt-1">
              {links.map(renderLink)}
            </div>
          )}

          {note && !isTerminal && (
            <p className="w-full text-[11px] text-muted-foreground/80 text-center">{note}</p>
          )}

          {canRedeem && onRedeem && (
            <button
              type="button"
              onClick={onRedeem}
              disabled={redeeming}
              className="w-full mt-1 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 border border-primary/40 text-primary hover:border-primary"
            >
              {redeeming ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {SWAP_PROGRESS_COPY.redeeming}
                </span>
              ) : (
                SWAP_PROGRESS_COPY.redeem
              )}
            </button>
          )}

          {redeemError && (
            <p className="w-full text-red-300 text-xs text-center break-words">{redeemError}</p>
          )}

          {isTerminal && (
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-3 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer glass-button text-white"
            >
              {SWAP_PROGRESS_COPY.done}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
