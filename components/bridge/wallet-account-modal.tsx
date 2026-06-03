'use client';

import { useEffect, useState } from 'react';
import { Wallet, Copy, LogOut, X, Check } from 'lucide-react';
import { useTokenBalance } from '@/hooks/use-token-balance';
import { getNativeToken } from '@/config/token_info';
import { type ActiveChainKey } from '@/config/active_chains';
import { WALLET_MODAL_COPY, WALLET_COPY_FEEDBACK_MS } from '@/config/ui_config';

interface WalletAccountModalProps {
  open: boolean;
  address: string;
  chainKey: ActiveChainKey;
  onClose: () => void;
  onDisconnect: () => void | Promise<void>;
}

const shorten = (addr: string): string =>
  addr.length <= 12 ? addr : `${addr.slice(0, 5)}…${addr.slice(-4)}`;

export function WalletAccountModal({
  open,
  address,
  chainKey,
  onClose,
  onDisconnect,
}: WalletAccountModalProps) {
  const [copied, setCopied] = useState(false);
  const nativeToken = getNativeToken(chainKey);
  const balance = useTokenBalance(chainKey, nativeToken);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), WALLET_COPY_FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [copied]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      // Browsers without clipboard access just won't update the label.
    }
  };

  const handleDisconnect = async () => {
    try {
      await onDisconnect();
    } finally {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[110] flex items-center justify-center px-4 py-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm glass-card rounded-2xl p-6 relative animate-in zoom-in-95 duration-150"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={WALLET_MODAL_COPY.close}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-3 mt-2">
          <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Wallet className="w-7 h-7 text-primary" />
          </div>

          <div className="text-foreground text-lg font-semibold tabular-nums">
            {shorten(address)}
          </div>

          <div className="text-muted-foreground text-xs tabular-nums min-h-[16px]">
            {balance.loading
              ? '…'
              : balance.formatted !== null
                ? `${balance.formatted} ${nativeToken.symbol}`
                : ''}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <button
            type="button"
            onClick={handleCopy}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 text-foreground/80" />
            )}
            <span className="text-xs text-foreground/90 font-medium">
              {copied ? WALLET_MODAL_COPY.copyAddressDone : WALLET_MODAL_COPY.copyAddress}
            </span>
          </button>

          <button
            type="button"
            onClick={handleDisconnect}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-foreground/80" />
            <span className="text-xs text-foreground/90 font-medium">
              {WALLET_MODAL_COPY.disconnect}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
