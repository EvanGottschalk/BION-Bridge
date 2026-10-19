import { getActiveChain, getActiveChainByRelayId, buildExplorerTxUrl } from '@/config/active_chains';
import { RELAY_APP_FEE_BPS } from '@/config/relay_config';
import {
  QUOTE_FEE_LABEL_BPS_FALLBACK,
  QUOTE_ROW_LABELS,
  STATUS_COPY,
  SWAP_PROGRESS_COPY,
} from '@/config/ui_config';
import { getRelayApi } from '@/lib/relay/client';
import { buildQuoteRequest, parseQuote, type ParsedQuote } from '@/lib/relay/quote';
import { executeSteps } from '@/lib/relay/execute';
import { pollStatus } from '@/lib/relay/status';
import type { RelayStatus, RelayStatusResponse } from '@/lib/relay/types';
import type {
  BridgeLink,
  BridgeProgress,
  BridgeProvider,
  BridgeQuote,
  BridgeQuoteRow,
  BridgeReceipt,
} from '../types';

const fmtUsd = (v?: string): string | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (Number.isNaN(n)) return undefined;
  if (n < 0.01) return '<$0.01';
  return `$${n.toFixed(2)}`;
};

const feeLabel = (): string => {
  const pct = RELAY_APP_FEE_BPS / 100;
  if (!Number.isFinite(pct)) return QUOTE_FEE_LABEL_BPS_FALLBACK;
  return `${pct}% fee`;
};

// Same rows QuoteSummary rendered before the provider split; a row is skipped
// when Relay didn't return that field.
const buildRows = (q: ParsedQuote): BridgeQuoteRow[] => {
  const rows: Array<BridgeQuoteRow | undefined> = [
    q.rate ? { label: QUOTE_ROW_LABELS.rate, value: q.rate } : undefined,
    fmtUsd(q.outputAmountUsd)
      ? { label: QUOTE_ROW_LABELS.outputValue, value: fmtUsd(q.outputAmountUsd)! }
      : undefined,
    fmtUsd(q.feeBreakdownUsd.gas)
      ? { label: QUOTE_ROW_LABELS.gas, value: fmtUsd(q.feeBreakdownUsd.gas)! }
      : undefined,
    fmtUsd(q.feeBreakdownUsd.relayerService)
      ? { label: QUOTE_ROW_LABELS.relayerFee, value: fmtUsd(q.feeBreakdownUsd.relayerService)! }
      : undefined,
    fmtUsd(q.feeBreakdownUsd.app)
      ? { label: QUOTE_ROW_LABELS.appFee, value: fmtUsd(q.feeBreakdownUsd.app)! }
      : undefined,
    q.feeBreakdownUsd.totalImpactPercent
      ? { label: QUOTE_ROW_LABELS.priceImpact, value: `${q.feeBreakdownUsd.totalImpactPercent}%` }
      : undefined,
    q.slippagePercent
      ? { label: QUOTE_ROW_LABELS.slippage, value: `${q.slippagePercent}%` }
      : undefined,
  ];
  return rows.filter((r): r is BridgeQuoteRow => Boolean(r));
};

const STAGE_ORDER: RelayStatus[] = ['waiting', 'pending', 'submitted', 'success'];

const stageIndex = (s: RelayStatus): number => {
  const i = STAGE_ORDER.indexOf(s);
  return i === -1 ? 0 : i;
};

const statusLinks = (s: RelayStatusResponse): BridgeLink[] => {
  const links: BridgeLink[] = [];
  const origin = getActiveChainByRelayId(s.originChainId ?? 0);
  const dest = getActiveChainByRelayId(s.destinationChainId ?? 0);
  if (s.inTxHashes?.[0] && origin) {
    links.push({ label: SWAP_PROGRESS_COPY.originTx, href: buildExplorerTxUrl(origin.key, s.inTxHashes[0]) });
  }
  if (s.txHashes?.[0] && dest) {
    links.push({ label: SWAP_PROGRESS_COPY.destinationTx, href: buildExplorerTxUrl(dest.key, s.txHashes[0]) });
  }
  return links;
};

const toProgress = (s: RelayStatusResponse): BridgeProgress => {
  const copy = STATUS_COPY[s.status] ?? STATUS_COPY.awaiting;
  const links = statusLinks(s);
  if (s.status === 'success') return { kind: 'success', copy, links };
  if (s.status === 'refunded' || s.status === 'refund') return { kind: 'refunded', copy, links };
  if (s.status === 'failure') {
    return { kind: 'failure', copy, message: s.details ?? SWAP_PROGRESS_COPY.swapFailed, links };
  }
  return { kind: 'tracking', stage: stageIndex(s.status), copy, links };
};

type RelayRaw = { parsed: ParsedQuote; testnet: boolean };
type RelayReceiptData = { requestId: string; testnet: boolean };

export const relayProvider: BridgeProvider = {
  id: 'relay',

  async quote(route, signal): Promise<BridgeQuote> {
    const testnet = getActiveChain(route.fromChain).isTestnet;
    const req = buildQuoteRequest({
      fromChain: route.fromChain,
      toChain: route.toChain,
      fromToken: route.fromToken,
      toToken: route.toToken,
      amount: route.amount,
      user: route.user,
      recipient: route.recipient,
    });
    const resp = await getRelayApi(testnet).getQuote(req, signal);
    const parsed = parseQuote(resp);
    const raw: RelayRaw = { parsed, testnet };
    return {
      provider: 'relay',
      route,
      outputAmountFormatted: parsed.outputAmountFormatted,
      timeEstimateSeconds: parsed.timeEstimateSeconds,
      feeLabel: feeLabel(),
      rows: buildRows(parsed),
      raw,
    };
  },

  async execute(quote, signers, onProgress): Promise<BridgeReceipt> {
    const { parsed, testnet } = quote.raw as RelayRaw;
    onProgress({ kind: 'executing', label: SWAP_PROGRESS_COPY.confirmInWallet });
    const result = await executeSteps(parsed.raw.steps, {
      evm: signers.evm,
      svm: signers.svm,
      originChainId: getActiveChain(quote.route.fromChain).relayChainId,
      destinationChainId: getActiveChain(quote.route.toChain).relayChainId,
      testnet,
      onProgress: (p) => {
        if (p.kind === 'tx-sent') {
          onProgress({ kind: 'executing', label: SWAP_PROGRESS_COPY.txBroadcast });
        } else if (p.kind === 'sig-sent') {
          onProgress({ kind: 'executing', label: SWAP_PROGRESS_COPY.sigSubmitted });
        }
      },
    });
    const requestId = result.requestId || parsed.requestIds[0];
    if (!requestId) throw new Error(SWAP_PROGRESS_COPY.noRequestId);
    const data: RelayReceiptData = { requestId, testnet };
    return { provider: 'relay', data };
  },

  async track(receipt, onProgress, signal): Promise<BridgeProgress> {
    const { requestId, testnet } = receipt.data as RelayReceiptData;
    const final = await pollStatus(requestId, {
      testnet,
      signal,
      onUpdate: (s) => onProgress(toProgress(s)),
    });
    return toProgress(final);
  },
};
