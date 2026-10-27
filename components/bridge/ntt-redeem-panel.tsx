'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { getActiveChain, type ActiveChainKey } from '@/config/active_chains';
import { NTT_HISTORY_COPY, NTT_REDEEM_COPY } from '@/config/ui_config';
import type { NttHistoryItem } from '@/lib/ntt/history';
import { NttHistoryList } from './ntt-history-list';

interface NttRedeemPanelProps {
  fromChain: ActiveChainKey;
  toChain: ActiveChainKey;
  network: 'Mainnet' | 'Testnet';
  defaultTxid?: string; // latest known pending transfer for this route
  destConnected: boolean;
  addresses: string[]; // connected wallet addresses, for the past-transactions list
  connectedVms: { evm: boolean; svm: boolean };
  busy: boolean;
  onRedeem: (txid: string) => void;
  onRedeemItem: (item: NttHistoryItem) => void;
}

// Backup recovery for NTT transfers the primary Redeem button can't reach
// (e.g. sent from another browser): pick one from the wallet's past
// transactions, or paste the source tx hash. Collapsed by default; the primary
// button is the normal redeem path.
export function NttRedeemPanel({
  fromChain,
  toChain,
  network,
  defaultTxid,
  destConnected,
  addresses,
  connectedVms,
  busy,
  onRedeem,
  onRedeemItem,
}: NttRedeemPanelProps) {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyTick, setHistoryTick] = useState(0); // each press re-checks for new transactions
  const [txid, setTxid] = useState(defaultTxid ?? '');

  useEffect(() => {
    if (defaultTxid) setTxid(defaultTxid);
  }, [defaultTxid]);

  const from = getActiveChain(fromChain);
  const to = getActiveChain(toChain);
  const trimmed = txid.trim();

  return (
    <div className="glass-inner rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        aria-expanded={open}
      >
        <span className="font-medium uppercase tracking-wider">{NTT_REDEEM_COPY.toggle}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <button
            type="button"
            onClick={() => {
              setShowHistory(true);
              setHistoryTick((t) => t + 1);
            }}
            className="w-full py-2 rounded-lg text-xs font-semibold border border-white/15 text-foreground hover:border-primary/50 transition-colors cursor-pointer"
          >
            {NTT_HISTORY_COPY.show}
          </button>
          {showHistory && (
            <NttHistoryList
              refreshKey={historyTick}
              network={network}
              addresses={addresses}
              connectedVms={connectedVms}
              busy={busy}
              onRedeem={onRedeemItem}
            />
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {NTT_REDEEM_COPY.explainer(from.displayName, to.displayName)}
          </p>
          <label className="block">
            <span className="sr-only">{NTT_REDEEM_COPY.inputLabel}</span>
            <input
              type="text"
              value={txid}
              onChange={(e) => setTxid(e.target.value)}
              placeholder={NTT_REDEEM_COPY.inputPlaceholder}
              spellCheck={false}
              autoComplete="off"
              className="w-full bg-[#0c0e1e] rounded-lg px-3 py-2.5 border border-white/15 focus:border-primary/40 text-xs text-foreground font-mono outline-none placeholder:text-muted-foreground/50 min-w-0"
            />
          </label>
          <button
            type="button"
            onClick={() => onRedeem(trimmed)}
            disabled={!trimmed || !destConnected || busy}
            className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 border border-primary/40 text-primary hover:border-primary"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {NTT_REDEEM_COPY.redeem}
              </span>
            ) : destConnected ? (
              NTT_REDEEM_COPY.redeem
            ) : (
              NTT_REDEEM_COPY.connectWallet(to.vmType)
            )}
          </button>
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
            {NTT_REDEEM_COPY.payerNote(to.displayName)}
          </p>
        </div>
      )}
    </div>
  );
}
