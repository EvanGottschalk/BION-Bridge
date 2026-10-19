// Adapts our wallet signers (lib/wallets/signers.ts) to the Wormhole SDK's
// SignAndSendSigner interface.

import type {
  Chain,
  Network,
  SignAndSendSigner,
  TxHash,
  UnsignedTransaction,
} from '@wormhole-foundation/sdk-connect';
import type { EvmUnsignedTransaction } from '@wormhole-foundation/sdk-evm';
import type { SolanaUnsignedTransaction } from '@wormhole-foundation/sdk-solana';
import type { EvmSigner, SvmSigner } from '@/lib/relay/execute';

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

/** Solana: the wallet signs, then any SDK keypairs (e.g. the NTT outbox item). */
export const makeSvmWhSigner = <N extends Network, C extends Chain>(
  chain: C,
  address: string,
  svm: SvmSigner,
  onSent?: OnTxSent
): SignAndSendSigner<N, C> => ({
  chain: () => chain,
  address: () => address,
  signAndSend: async (txs: UnsignedTransaction<N, C>[]): Promise<TxHash[]> => {
    const sigs: TxHash[] = [];
    for (const utx of txs) {
      const { transaction, signers } = (utx as unknown as SolanaUnsignedTransaction<N>).transaction;
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
