import type {
  RelayStep,
  RelayStepItem,
  RelayTransactionData,
  RelaySignatureData,
} from './types';
import { isEvmChainId, isSolanaChainId } from '@/config/active_chains';
import { relayApi } from './client';

export type EvmTxRequest = {
  chainId: number;
  to: `0x${string}`;
  data: `0x${string}`;
  value?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
};

export type EvmTypedDataRequest = {
  domain: unknown;
  types: unknown;
  primaryType: string;
  message: unknown;
};

export type EvmSigner = {
  switchChain: (chainId: number) => Promise<void>;
  sendTransaction: (req: EvmTxRequest) => Promise<`0x${string}`>;
  signTypedData: (req: EvmTypedDataRequest) => Promise<`0x${string}`>;
};

export type SvmSigner = {
  sendBase64Tx: (base64Tx: string) => Promise<string>;
  sendRawInstructions?: (instructions: unknown) => Promise<string>;
};

export type ExecuteProgress =
  | { kind: 'step-start'; step: RelayStep; itemIndex: number }
  | { kind: 'tx-sent'; step: RelayStep; itemIndex: number; chainId: number; txHash: string }
  | { kind: 'sig-sent'; step: RelayStep; itemIndex: number; signature: string }
  | { kind: 'step-complete'; step: RelayStep };

export type ExecuteResult = {
  requestId: string;
  txHashes: Array<{ chainId: number; txHash: string }>;
  signatures: string[];
};

const toBig = (v: unknown): bigint | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  try {
    return BigInt(v as string | number | bigint);
  } catch {
    return undefined;
  }
};

const hex = (v: unknown): `0x${string}` | undefined => {
  if (typeof v !== 'string') return undefined;
  return v.startsWith('0x') ? (v as `0x${string}`) : (`0x${v}` as `0x${string}`);
};

// Base64 character set (RFC 4648, padded). Used to detect serialized Solana
// transactions inside the step payload without knowing the exact field name.
const BASE64_LIKE = /^[A-Za-z0-9+/]+={0,2}$/;

// A Solana wallet address is ~44 base58 chars, well below this floor. A real
// serialized VersionedTransaction is hundreds of bytes ⇒ hundreds of base64
// chars, so this threshold keeps account-id-style strings out of the match.
const looksLikeBase64Tx = (s: string): boolean =>
  s.length >= 150 && s.length <= 32768 && BASE64_LIKE.test(s);

// Walks the step payload looking for a serialized Solana transaction. We try
// the documented field names first, then fall back to a structural scan so we
// survive minor shape changes in Relay's response.
const extractSolanaBase64Tx = (data: unknown): string | undefined => {
  if (typeof data === 'string' && looksLikeBase64Tx(data)) return data;
  if (!data || typeof data !== 'object') return undefined;

  const obj = data as Record<string, unknown>;
  const namedCandidates = [
    obj.data,
    obj.transaction,
    obj.serializedTransaction,
    obj.serializedTx,
    obj.tx,
    obj.txBase64,
    obj.payload,
    obj.message,
    obj.value,
    obj.base64,
    obj.signedTransaction,
    obj.unsignedTransaction,
    obj.encoded,
    obj.raw,
  ];
  for (const c of namedCandidates) {
    if (typeof c === 'string' && looksLikeBase64Tx(c)) return c;
  }

  for (const value of Object.values(obj)) {
    if (typeof value === 'string' && looksLikeBase64Tx(value)) return value;
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      const found = extractSolanaBase64Tx(value);
      if (found) return found;
    }
  }

  return undefined;
};

const describeKeys = (data: unknown): string => {
  if (!data || typeof data !== 'object') return typeof data;
  const obj = data as Record<string, unknown>;
  return Object.entries(obj)
    .map(([k, v]) => `${k}:${typeof v === 'string' ? `string(${v.length})` : typeof v}`)
    .join(', ');
};

export type ExecuteOptions = {
  evm: EvmSigner | null;
  svm: SvmSigner | null;
  // Fallback chain ids used when an individual step's `data.chainId` is
  // missing. Solana steps in particular don't echo the chain id back in the
  // step payload, so the caller passes them in from the quote request.
  originChainId?: number;
  destinationChainId?: number;
  onProgress?: (p: ExecuteProgress) => void;
  signal?: AbortSignal;
};

export const executeSteps = async (
  steps: RelayStep[],
  opts: ExecuteOptions
): Promise<ExecuteResult> => {
  const result: ExecuteResult = {
    requestId: steps[0]?.requestId ?? '',
    txHashes: [],
    signatures: [],
  };

  for (const step of steps) {
    for (let i = 0; i < step.items.length; i++) {
      const item = step.items[i];
      if (item.status === 'complete') continue;
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      opts.onProgress?.({ kind: 'step-start', step, itemIndex: i });

      if (step.kind === 'transaction') {
        await runTxItem(step, item, i, opts, result);
      } else if (step.kind === 'signature') {
        await runSigItem(step, item, i, opts, result);
      }
    }
    opts.onProgress?.({ kind: 'step-complete', step });
  }
  return result;
};

const hasSolanaTxBlob = (data: RelayTransactionData): boolean =>
  extractSolanaBase64Tx(data) !== undefined;

const looksLikeEvmStep = (data: RelayTransactionData): boolean =>
  typeof data.to === 'string' && /^0x[a-fA-F0-9]{40}$/.test(data.to);

async function runTxItem(
  step: RelayStep,
  item: RelayStepItem,
  itemIndex: number,
  opts: ExecuteOptions,
  result: ExecuteResult
) {
  const data = item.data as RelayTransactionData;
  // Deposit steps execute on the origin chain. When `data.chainId` is absent
  // (Solana steps don't include one), fall back to the originChainId the
  // caller passed in.
  const chainId = data.chainId ?? opts.originChainId;

  const isEvm = chainId !== undefined ? isEvmChainId(chainId) : looksLikeEvmStep(data);
  const isSvm =
    chainId !== undefined ? isSolanaChainId(chainId) : hasSolanaTxBlob(data);

  if (isEvm) {
    if (!opts.evm) throw new Error('EVM wallet required for this step');
    const effectiveChainId = chainId ?? opts.originChainId;
    if (effectiveChainId === undefined) {
      throw new Error(`Could not determine EVM chain id for step ${step.id}`);
    }
    await opts.evm.switchChain(effectiveChainId);
    const to = hex(data.to);
    const txData = hex(data.data) ?? ('0x' as `0x${string}`);
    if (!to) throw new Error('EVM step missing `to` address');
    const txHash = await opts.evm.sendTransaction({
      chainId: effectiveChainId,
      to,
      data: txData,
      value: toBig(data.value),
      maxFeePerGas: toBig(data.maxFeePerGas),
      maxPriorityFeePerGas: toBig(data.maxPriorityFeePerGas),
    });
    result.txHashes.push({ chainId: effectiveChainId, txHash });
    opts.onProgress?.({
      kind: 'tx-sent',
      step,
      itemIndex,
      chainId: effectiveChainId,
      txHash,
    });
    return;
  }

  if (isSvm) {
    if (!opts.svm) throw new Error('Solana wallet required for this step');
    const effectiveChainId = chainId ?? opts.originChainId ?? 0;
    const base64 = extractSolanaBase64Tx(data);
    let txHash: string;
    if (base64) {
      txHash = await opts.svm.sendBase64Tx(base64);
    } else if (opts.svm.sendRawInstructions && data.instructions) {
      // Relay returns structured instructions + ALT addresses for SVM origin
      // steps. Hand the whole payload over so the signer can assemble a v0
      // message with the resolved lookup tables.
      txHash = await opts.svm.sendRawInstructions(data);
    } else {
      if (typeof window !== 'undefined') {
        console.error('[relay/execute] Solana step had unexpected shape:', { step, data });
      }
      throw new Error(
        `Solana step had no recognisable transaction payload. data fields: { ${describeKeys(
          data
        )} }`
      );
    }
    result.txHashes.push({ chainId: effectiveChainId, txHash });
    opts.onProgress?.({
      kind: 'tx-sent',
      step,
      itemIndex,
      chainId: effectiveChainId,
      txHash,
    });
    return;
  }

  throw new Error(
    `Unsupported chain id in step "${step.id}" (kind=${step.kind}, chainId=${String(
      chainId
    )}).`
  );
}

async function runSigItem(
  step: RelayStep,
  item: RelayStepItem,
  itemIndex: number,
  opts: ExecuteOptions,
  result: ExecuteResult
) {
  const data = item.data as RelaySignatureData;
  if (!opts.evm) throw new Error('EVM wallet required for signature step');
  const signature = await opts.evm.signTypedData({
    domain: (data as Record<string, unknown>).domain,
    types: (data as Record<string, unknown>).types,
    primaryType: (data.primaryType ?? 'Permit') as string,
    message: data.message,
  });
  result.signatures.push(signature);
  opts.onProgress?.({ kind: 'sig-sent', step, itemIndex, signature });

  if (data.post && data.post.endpoint) {
    await relayApi.postPermit(data.post.endpoint, {
      kind: 'request',
      requestId: step.requestId,
    });
  }
}
