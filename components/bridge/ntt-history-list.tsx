'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { buildExplorerTxUrl, getActiveChain } from '@/config/active_chains';
import {
  NTT_HISTORY_COPY,
  NTT_HISTORY_DATE_FORMAT,
  NTT_HISTORY_TX_TRUNCATE,
  WALLET_COPY_FEEDBACK_MS,
} from '@/config/ui_config';
import { fetchNttHistory, type NttHistoryItem } from '@/lib/ntt/history';
import { loadNttTransferStatus } from '@/lib/bridge/router';
import type { NttTransferStatus } from '@/lib/bridge/providers/ntt';

interface NttHistoryListProps {
  network: 'Mainnet' | 'Testnet';
  addresses: string[]; // connected wallet addresses
  connectedVms: { evm: boolean; svm: boolean };
  busy: boolean; // a transfer or redeem is in flight
  onRedeem: (item: NttHistoryItem) => void;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; items: NttHistoryItem[] };

const truncateTx = (tx: string): string =>
  tx.length <= NTT_HISTORY_TX_TRUNCATE.head + NTT_HISTORY_TX_TRUNCATE.tail + 1
    ? tx
    : `${tx.slice(0, NTT_HISTORY_TX_TRUNCATE.head)}…${tx.slice(-NTT_HISTORY_TX_TRUNCATE.tail)}`;

// Up to NTT_HISTORY_LIMIT past NTT bridgings for the connected wallets, each
// with its on-chain redemption status (and a Redeem button when redeemable).
export function NttHistoryList({ network, addresses, connectedVms, busy, onRedeem }: NttHistoryListProps) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [statuses, setStatuses] = useState<Record<string, NttTransferStatus>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const addressKey = addresses.join(',');

  // Re-fetch when wallets/mode change, on retry, and whenever an in-flight
  // transfer or redeem finishes (busy → false), so statuses stay current.
  useEffect(() => {
    if (!addressKey) return;
    const controller = new AbortController();
    let cancelled = false;
    setLoad({ kind: 'loading' });
    setStatuses({});
    (async () => {
      const items = await fetchNttHistory(network, addressKey.split(','), controller.signal);
      if (cancelled) return;
      setLoad({ kind: 'ready', items });
      if (!items.length) return;
      const getStatus = await loadNttTransferStatus();
      await Promise.all(
        items.map(async (item) => {
          const status = await getStatus(item);
          if (!cancelled) setStatuses((s) => ({ ...s, [item.id]: status }));
        })
      );
    })().catch(() => {
      if (!cancelled) setLoad({ kind: 'error' });
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [network, addressKey, busy, reloadTick]);

  useEffect(() => {
    if (!copiedId) return;
    const id = setTimeout(() => setCopiedId(null), WALLET_COPY_FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [copiedId]);

  const copy = useCallback(async (item: NttHistoryItem) => {
    try {
      await navigator.clipboard.writeText(item.txid);
      setCopiedId(item.id);
    } catch {
      // Browsers without clipboard access just won't show the check mark.
    }
  }, []);

  if (!addressKey) {
    return <p className="text-[11px] text-muted-foreground">{NTT_HISTORY_COPY.connectWallet}</p>;
  }
  if (load.kind === 'loading') {
    return (
      <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {NTT_HISTORY_COPY.loading}
      </p>
    );
  }
  if (load.kind === 'error') {
    return (
      <p className="text-[11px] text-red-300">
        {NTT_HISTORY_COPY.loadFailed}{' '}
        <button
          type="button"
          onClick={() => setReloadTick((t) => t + 1)}
          className="underline cursor-pointer hover:text-red-200"
        >
          {NTT_HISTORY_COPY.retry}
        </button>
      </p>
    );
  }
  if (!load.items.length) {
    return <p className="text-[11px] text-muted-foreground">{NTT_HISTORY_COPY.empty}</p>;
  }

  return (
    <ul className="space-y-2">
      {load.items.map((item) => {
        const from = getActiveChain(item.fromChain);
        const to = getActiveChain(item.toChain);
        const status = statuses[item.id];
        const canSign = connectedVms[to.vmType];
        return (
          <li
            key={item.id}
            className="rounded-lg border border-white/10 bg-[#0c0e1e] px-3 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {item.amountFormatted} {item.symbol}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  {from.displayName}
                  <ArrowRight className="w-3 h-3 shrink-0" />
                  {to.displayName}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span className="tabular-nums">
                  {item.timestamp
                    ? new Date(item.timestamp).toLocaleString(undefined, NTT_HISTORY_DATE_FORMAT)
                    : ''}
                </span>
                <span className="flex items-center gap-1.5">
                  <a
                    href={buildExplorerTxUrl(item.fromChain, item.txid)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={NTT_HISTORY_COPY.viewTx}
                    className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
                  >
                    {truncateTx(item.txid)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => copy(item)}
                    aria-label={NTT_HISTORY_COPY.copyTx}
                    title={copiedId === item.id ? NTT_HISTORY_COPY.copied : NTT_HISTORY_COPY.copyTx}
                    className="p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </span>
              </div>
            </div>

            <div className="shrink-0">
              {status === undefined ? (
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {NTT_HISTORY_COPY.status.checking}
                </span>
              ) : status === 'redeemable' ? (
                <button
                  type="button"
                  onClick={() => onRedeem(item)}
                  disabled={busy || !canSign}
                  title={canSign ? undefined : NTT_HISTORY_COPY.connectToRedeem(to.vmType)}
                  className="w-full sm:w-auto px-4 py-1.5 rounded-lg font-semibold text-xs transition-all duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 glass-button text-white"
                >
                  {NTT_HISTORY_COPY.redeem}
                </button>
              ) : (
                <span
                  className={`text-[11px] font-medium ${
                    status === 'redeemed'
                      ? 'text-emerald-400'
                      : status === 'unknown'
                        ? 'text-muted-foreground'
                        : 'text-amber-300'
                  }`}
                >
                  {NTT_HISTORY_COPY.status[status]}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
