// Past NTT transfers for the connected wallets, from Wormholescan's operations
// API. No SDK imports: redemption status is checked separately, on-chain, by
// getNttTransferStatus (lib/bridge/providers/ntt.ts).

import type { ChainKey } from '@/config/blockchain_config';
import { ALL_CHAINS, type ActiveChainKey } from '@/config/active_chains';
import {
  NTT_HISTORY_FETCH_PAGE_SIZE,
  NTT_HISTORY_LIMIT,
  NTT_TRIMMED_DECIMALS,
  WORMHOLE_CHAIN_ID_BY_CHAINKEY,
  WORMHOLESCAN_OPERATIONS_URL,
} from '@/config/ntt_config';
import { fromBaseUnits } from '@/lib/relay/quote';
import { findNttChainEntry } from './registry';

type WhNetwork = 'Mainnet' | 'Testnet';

export type NttHistoryItem = {
  id: string;
  symbol: string;
  network: WhNetwork;
  fromChain: ActiveChainKey;
  toChain: ActiveChainKey;
  txid: string; // source-chain transaction
  timestamp: number; // ms
  amountFormatted: string; // bridged amount (after our fee)
  vaa?: string; // base64 Guardian-signed VAA, once available
};

// The subset of a Wormholescan operation we read.
type Operation = {
  id: string;
  vaa?: { raw?: string };
  content?: {
    standarizedProperties?: {
      appIds?: string[];
      fromChain?: number;
      toChain?: number;
      tokenChain?: number;
      tokenAddress?: string;
      amount?: string;
      normalizedDecimals?: number;
    };
  };
  sourceChain?: { timestamp?: string; transaction?: { txHash?: string } };
};

const chainFor = (wormholeId: number | undefined, network: WhNetwork): ActiveChainKey | undefined =>
  wormholeId === undefined
    ? undefined
    : ALL_CHAINS.find(
        (c) =>
          c.isTestnet === (network === 'Testnet') &&
          WORMHOLE_CHAIN_ID_BY_CHAINKEY[c.chainKey as ChainKey] === wormholeId
      )?.key;

// Keeps only transfers of tokens in NTT_BRIDGE_INFO between chains we support.
const toItem = (op: Operation, network: WhNetwork): NttHistoryItem | undefined => {
  const p = op.content?.standarizedProperties;
  const txid = op.sourceChain?.transaction?.txHash;
  if (!p || !txid || !p.tokenAddress || !p.amount) return undefined;
  const fromChain = chainFor(p.fromChain, network);
  const toChain = chainFor(p.toChain, network);
  const tokenChain = chainFor(p.tokenChain, network);
  if (!fromChain || !toChain || !tokenChain) return undefined;
  const match = findNttChainEntry(tokenChain, p.tokenAddress);
  if (!match) return undefined;
  const chains = match.deployment.chains;
  const fromKey = ALL_CHAINS.find((c) => c.key === fromChain)!.chainKey as ChainKey;
  const toKey = ALL_CHAINS.find((c) => c.key === toChain)!.chainKey as ChainKey;
  if (!chains[fromKey] || !chains[toKey]) return undefined;

  let amountFormatted: string;
  try {
    amountFormatted = fromBaseUnits(BigInt(p.amount), p.normalizedDecimals ?? NTT_TRIMMED_DECIMALS);
  } catch {
    return undefined;
  }
  const timestamp = op.sourceChain?.timestamp ? Date.parse(op.sourceChain.timestamp) : NaN;
  return {
    id: op.id,
    symbol: match.symbol,
    network,
    fromChain,
    toChain,
    txid,
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    amountFormatted,
    vaa: op.vaa?.raw || undefined,
  };
};

const fetchOperations = async (
  network: WhNetwork,
  address: string,
  signal?: AbortSignal
): Promise<Operation[]> => {
  const res = await fetch(WORMHOLESCAN_OPERATIONS_URL(network, address, NTT_HISTORY_FETCH_PAGE_SIZE), {
    signal,
  });
  if (!res.ok) throw new Error(`Wormholescan ${res.status}`);
  const body = (await res.json()) as { operations?: Operation[] };
  return body.operations ?? [];
};

/** The most recent NTT transfers sent from or to any of `addresses`, newest first. */
export const fetchNttHistory = async (
  network: WhNetwork,
  addresses: string[],
  signal?: AbortSignal
): Promise<NttHistoryItem[]> => {
  const unique = [...new Set(addresses.filter(Boolean))];
  const pages = await Promise.all(unique.map((a) => fetchOperations(network, a, signal)));
  const byId = new Map<string, NttHistoryItem>();
  for (const op of pages.flat()) {
    if (byId.has(op.id)) continue;
    const item = toItem(op, network);
    if (item) byId.set(op.id, item);
  }
  return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, NTT_HISTORY_LIMIT);
};
