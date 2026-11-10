'use client';

import { useEffect, useState, type RefObject } from 'react';
import { Wallet, Copy, LogOut, Check } from 'lucide-react';
import { useTokenBalance } from '@/hooks/use-token-balance';
import { getNativeToken } from '@/config/token_info';
import { type ActiveChainKey } from '@/config/active_chains';
import { WALLET_MODAL_COPY, WALLET_COPY_FEEDBACK_MS } from '@/config/ui_config';

interface WalletAccountModalProps {
  open: boolean;
  address: string;
  chainKey: ActiveChainKey;
  // Wrapper around the wallet button + this menu. It is `sm:relative`, so on
  // phones the menu anchors to the header and spans it with 16px gutters.
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onDisconnect: () => void | Promise<void>;
}

// Account menu that drops down from the wallet button in the header (not a
// centered modal): address, native balance, copy and disconnect.

const shorten = (addr: string): string =>
  addr.length <= 12 ? addr : `${addr.slice(0, 5)}…${addr.slice(-4)}`;

export function WalletAccountModal({
  open,
  address,
  chainKey,
  anchorRef,
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

  // Close on a click/tap outside the anchor (the wallet button + this menu) or on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, anchorRef, onClose]);

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
      role="menu"
      className="absolute top-full mt-2 left-4 right-4 sm:left-auto sm:right-0 sm:w-72 z-[110] bg-[#0c0e1e] border border-white/15 rounded-2xl p-4 shadow-xl shadow-black/40 animate-in fade-in slide-in-from-top-2 duration-150"
    >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-foreground text-sm font-semibold tabular-nums truncate">
              {shorten(address)}
            </div>
            <div className="text-muted-foreground text-xs tabular-nums min-h-[16px] truncate">
              {balance.loading
                ? '…'
                : balance.formatted !== null
                  ? `${balance.formatted} ${nativeToken.symbol}`
                  : ''}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
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
  );
}
