// Provider-neutral bridging types. BridgeCard, QuoteSummary, and SwapProgress
// only see these; Relay- and NTT-specific shapes stay behind each provider.

import type { ActiveChainKey } from '@/config/active_chains';
import type { TokenInfo } from '@/config/token_info';
import type { EvmSigner, SvmSigner } from '@/lib/relay/execute';

export type BridgeProviderId = 'relay' | 'ntt';

export type BridgeRoute = {
  fromChain: ActiveChainKey;
  toChain: ActiveChainKey;
  fromToken: TokenInfo;
  toToken: TokenInfo;
  amount: string; // human-readable units
  user: string; // origin-chain wallet address
  recipient?: string; // destination-chain wallet address
};

export type BridgeQuoteRow = { label: string; value: string };

export type BridgeQuote = {
  provider: BridgeProviderId;
  route: BridgeRoute;
  outputAmountFormatted: string;
  timeEstimateSeconds?: number;
  feeLabel: string;
  rows: BridgeQuoteRow[];
  warning?: string;
  // Native gas the origin wallet must hold on top of tx gas (e.g. the NTT
  // Executor relay fee), in base units of the origin chain's native token.
  requiredNativeRaw?: bigint;
  raw: unknown; // provider-specific payload consumed by execute()
};

export type BridgeQuoteErrorCode = 'capacity';

export type BridgeQuoteState =
  | { kind: 'idle' }
  | { kind: 'loading'; previous?: BridgeQuote }
  | { kind: 'ready'; quote: BridgeQuote; fetchedAt: number }
  | { kind: 'error'; message: string; code?: BridgeQuoteErrorCode; previous?: BridgeQuote };

export class BridgeQuoteError extends Error {
  constructor(message: string, public code?: BridgeQuoteErrorCode) {
    super(message);
    this.name = 'BridgeQuoteError';
  }
}

export type BridgeLink = { label: string; href: string };

export type BridgeStageCopy = { title: string; body: string };

// stage = number of progress-bar segments filled minus one (0..3).
export type BridgeProgress =
  | { kind: 'awaiting' }
  | { kind: 'executing'; label: string }
  | {
      kind: 'tracking';
      stage: number;
      copy: BridgeStageCopy;
      links: BridgeLink[];
      note?: string;
      canRedeem?: boolean;
    }
  | { kind: 'success'; copy: BridgeStageCopy; links: BridgeLink[] }
  | { kind: 'refunded'; copy: BridgeStageCopy; links: BridgeLink[] }
  | { kind: 'failure'; copy: BridgeStageCopy; message: string; links: BridgeLink[]; canRedeem?: boolean };

export type BridgeSigners = {
  evm: EvmSigner | null;
  svm: SvmSigner | null;
  evmAddress?: string;
  svmAddress?: string;
};

// Mutable on purpose: providers update `data` as tracking advances so redeem()
// always acts on the latest state.
export type BridgeReceipt = { provider: BridgeProviderId; data: unknown };

export type ProgressCallback = (p: BridgeProgress) => void;

export interface BridgeProvider {
  id: BridgeProviderId;
  quote(route: BridgeRoute, signal: AbortSignal): Promise<BridgeQuote>;
  execute(quote: BridgeQuote, signers: BridgeSigners, onProgress: ProgressCallback): Promise<BridgeReceipt>;
  /** Resolves with a terminal state, or a non-terminal one if tracking timed out. */
  track(receipt: BridgeReceipt, onProgress: ProgressCallback, signal?: AbortSignal): Promise<BridgeProgress>;
  /** Manually finish a transfer the automatic relayer didn't deliver. */
  redeem?(receipt: BridgeReceipt, signers: BridgeSigners, onProgress: ProgressCallback): Promise<void>;
  /** Rebuild a receipt for a transfer started in an earlier page session. */
  resume?(record: unknown): Promise<BridgeReceipt>;
  /** Redeem on the destination chain given only the source tx hash. */
  redeemByTx?(record: unknown, signers: BridgeSigners, onProgress: ProgressCallback): Promise<BridgeReceipt>;
}

export const isTerminalProgress = (p: BridgeProgress): boolean =>
  p.kind === 'success' || p.kind === 'failure' || p.kind === 'refunded';
