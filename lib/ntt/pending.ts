// Per-viewer record of in-flight NTT transfers so tracking resumes after a
// reload. No SDK imports. Every storage access is guarded: a blocked or empty
// store just means nothing resumes.

import { NTT_PENDING_MAX_AGE_MS, NTT_PENDING_STORAGE_KEY } from '@/config/ntt_config';
import type { ActiveChainKey } from '@/config/active_chains';

export type PendingNttTransfer = {
  symbol: string;
  network: 'Mainnet' | 'Testnet';
  fromChain: ActiveChainKey;
  toChain: ActiveChainKey;
  txid: string; // last origin tx (the one that emitted the Wormhole message)
  startedAt: number;
};

const readAll = (): PendingNttTransfer[] => {
  try {
    const raw = window.localStorage.getItem(NTT_PENDING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingNttTransfer[];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - NTT_PENDING_MAX_AGE_MS;
    return parsed.filter((p) => p && typeof p.txid === 'string' && p.startedAt > cutoff);
  } catch {
    return [];
  }
};

const writeAll = (items: PendingNttTransfer[]) => {
  try {
    window.localStorage.setItem(NTT_PENDING_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore — resume just won't be available
  }
};

export const listPendingNtt = (network: 'Mainnet' | 'Testnet'): PendingNttTransfer[] =>
  readAll().filter((p) => p.network === network);

export const addPendingNtt = (item: PendingNttTransfer) => {
  writeAll([...readAll().filter((p) => p.txid !== item.txid), item]);
};

export const removePendingNtt = (txid: string) => {
  writeAll(readAll().filter((p) => p.txid !== txid));
};
