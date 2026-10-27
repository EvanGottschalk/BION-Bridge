// Adapts our wallet signers (lib/wallets/signers.ts) to the Wormhole SDK's
// SignAndSendSigner interface. Only loaded inside the NTT (SDK) chunk.

import type {
  Chain,
  Network,
  SignAndSendSigner,
  TxHash,
  UnsignedTransaction,
} from '@wormhole-foundation/sdk-connect';
import type { EvmUnsignedTransaction } from '@wormhole-foundation/sdk-evm';
import {
  createPriorityFeeInstructions,
  isVersionedTransaction,
  type SolanaUnsignedTransaction,
} from '@wormhole-foundation/sdk-solana';
import type { EvmSigner, SvmSigner } from '@/lib/relay/execute';
import { SOLANA_PRIORITY_FEE, SOLANA_PROGRAM_IDS } from '@/config/solana_config';
import { logSolanaWarning } from '@/lib/wallets/solana-diagnostics';

const toHex = (v: unknown): `0x${string}` | undefined => {
  if (typeof v !== 'string' || v === '') return undefined;
  return (v.startsWith('0x') ? v : `0x${v}`) as `0x${string}`;
};

const toBigInt = (v: unknown): bigint | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  return BigInt(v as string | number | bigint);
};

/**
 * Called the moment a tx is broadcast (before confirmation), so a sent
 * transfer is recorded even if a later step throws.
 */
export type OnTxSent = (txid: string, description: string) => void;

/**
 * EVM: each tx is sent and mined before the next one is sent, because NTT's
 * transfer tx depends on the preceding approve.
 */
export const makeEvmWhSigner = <N extends Network, C extends Chain>(
  chain: C,
  address: string,
  evmChainId: number,
  evm: EvmSigner,
  onSent?: OnTxSent
): SignAndSendSigner<N, C> => ({
  chain: () => chain,
  address: () => address,
  signAndSend: async (txs: UnsignedTransaction<N, C>[]): Promise<TxHash[]> => {
    const hashes: TxHash[] = [];
    for (const utx of txs) {
      const req = (utx as unknown as EvmUnsignedTransaction<N, never>).transaction;
      const to = toHex(typeof req.to === 'string' ? req.to : undefined);
      if (!to) throw new Error(`EVM transaction "${utx.description}" has no recipient`);
      await evm.switchChain(evmChainId);
      const hash = await evm.sendTransaction({
        chainId: evmChainId,
        to,
        data: toHex(req.data) ?? '0x',
        value: toBigInt(req.value),
      });
      onSent?.(hash, utx.description);
      await evm.waitForReceipt(evmChainId, hash);
      hashes.push(hash);
    }
    return hashes;
  },
});

type SdkSolanaRpc = Parameters<typeof createPriorityFeeInstructions>[0];
type SdkSolanaTx = Parameters<typeof createPriorityFeeInstructions>[1];

const hasComputeBudget = (tx: SdkSolanaTx): boolean =>
  isVersionedTransaction(tx)
    ? tx.message.compiledInstructions.some(
        (ix) => tx.message.staticAccountKeys[ix.programIdIndex]?.toBase58() === SOLANA_PROGRAM_IDS.computeBudget
      )
    : tx.instructions.some((ix) => ix.programId.toBase58() === SOLANA_PROGRAM_IDS.computeBudget);

// Appends SetComputeUnitLimit + SetComputeUnitPrice to the END of a legacy
// SDK tx, as the Wormhole SDK's own signer does. Wallets like Phantom then
// leave the tx alone instead of inserting their own priority-fee
// instructions at the FRONT, which shifts instruction indexes and breaks the
// secp256k1 precompile in Core.VerifySignature (custom program error 0x2).
// Built with the SDK's copy of @solana/web3.js so the tx stays consistent.
// v0 txs are left alone: the SDK's v0 txs use lookup tables and don't
// contain precompiles, and the pre-send check in lib/wallets/signers.ts
// still guards them.
const addPriorityFee = async (
  rpc: Promise<SdkSolanaRpc>,
  tx: SdkSolanaTx,
  description: string
): Promise<void> => {
  if (isVersionedTransaction(tx) || hasComputeBudget(tx)) return;
  try {
    const ixs = await createPriorityFeeInstructions(
      await rpc,
      tx,
      SOLANA_PRIORITY_FEE.percentile,
      SOLANA_PRIORITY_FEE.percentileMultiple,
      SOLANA_PRIORITY_FEE.minMicroLamports,
      SOLANA_PRIORITY_FEE.maxMicroLamports
    );
    tx.add(...ixs);
  } catch (err) {
    // Send without them; the pre-send check catches a wallet reordering.
    logSolanaWarning(`Could not add priority fee to "${description}"`, err);
  }
};

/**
 * Solana: the wallet signs, then any SDK keypairs (e.g. the NTT outbox item).
 * `rpc` is the SDK's own Connection, used to size the priority fee.
 */
export const makeSvmWhSigner = <N extends Network, C extends Chain>(
  chain: C,
  address: string,
  svm: SvmSigner,
  rpc: Promise<SdkSolanaRpc>,
  onSent?: OnTxSent
): SignAndSendSigner<N, C> => ({
  chain: () => chain,
  address: () => address,
  signAndSend: async (txs: UnsignedTransaction<N, C>[]): Promise<TxHash[]> => {
    const sigs: TxHash[] = [];
    for (const utx of txs) {
      const { transaction, signers } = (utx as unknown as SolanaUnsignedTransaction<N>).transaction;
      await addPriorityFee(rpc, transaction as SdkSolanaTx, utx.description);
      // The SDK bundles its own copy of @solana/web3.js, so its classes are
      // nominally different from ours but structurally identical.
      sigs.push(
        await svm.signAndSendTx(
          transaction as unknown as Parameters<SvmSigner['signAndSendTx']>[0],
          (signers ?? []) as unknown as Parameters<SvmSigner['signAndSendTx']>[1],
          (sig) => onSent?.(sig, utx.description)
        )
      );
    }
    return sigs;
  },
});
