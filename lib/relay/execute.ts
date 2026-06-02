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

const extractSolanaBase64Tx = (data: RelayTransactionData): string | undefined => {
  const candidates = [
    (data as Record<string, unknown>).data,
    (data as Record<string, unknown>).transaction,
    (data as Record<string, unknown>).serializedTransaction,
    (data as Record<string, unknown>).tx,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return undefined;
};

export type ExecuteOptions = {
  evm: EvmSigner | null;
  svm: SvmSigner | null;
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

async function runTxItem(
  step: RelayStep,
  item: RelayStepItem,
  itemIndex: number,
  opts: ExecuteOptions,
  result: ExecuteResult
) {
  const data = item.data as RelayTransactionData;
  const chainId = data.chainId;

  if (isEvmChainId(chainId)) {
    if (!opts.evm) throw new Error('EVM wallet required for this step');
    await opts.evm.switchChain(chainId);
    const to = hex(data.to);
    const txData = hex(data.data) ?? ('0x' as `0x${string}`);
    if (!to) throw new Error('EVM step missing `to` address');
    const txHash = await opts.evm.sendTransaction({
      chainId,
      to,
      data: txData,
      value: toBig(data.value),
      maxFeePerGas: toBig(data.maxFeePerGas),
      maxPriorityFeePerGas: toBig(data.maxPriorityFeePerGas),
    });
    result.txHashes.push({ chainId, txHash });
    opts.onProgress?.({ kind: 'tx-sent', step, itemIndex, chainId, txHash });
    return;
  }

  if (isSolanaChainId(chainId)) {
    if (!opts.svm) throw new Error('Solana wallet required for this step');
    const base64 = extractSolanaBase64Tx(data);
    let txHash: string;
    if (base64) {
      txHash = await opts.svm.sendBase64Tx(base64);
    } else if (opts.svm.sendRawInstructions && data.instructions) {
      txHash = await opts.svm.sendRawInstructions(data.instructions);
    } else {
      throw new Error('Solana step had no recognisable transaction payload');
    }
    result.txHashes.push({ chainId, txHash });
    opts.onProgress?.({ kind: 'tx-sent', step, itemIndex, chainId, txHash });
    return;
  }

  throw new Error(`Unsupported chain id in step: ${chainId}`);
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
