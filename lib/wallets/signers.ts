'use client';

import { useCallback, useMemo } from 'react';
import {
  useAccount,
  useConfig,
  useSwitchChain,
  useSendTransaction,
  useSignTypedData,
  useWalletClient,
} from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  Connection,
  VersionedTransaction,
  Transaction,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  AddressLookupTableAccount,
  type Keypair,
} from '@solana/web3.js';
import { txFailedOnChain, type EvmSigner, type SvmSigner } from '@/lib/relay/execute';
import {
  SOLANA_CONFIRM_POLL_INTERVAL_MS,
  SOLANA_CONFIRM_TIMEOUT_MS,
} from '@/config/blockchain_config';

const decodeBase64ToUint8 = (b64: string): Uint8Array => {
  if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(b64, 'base64'));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const decodeHexToUint8 = (hex: string): Uint8Array => {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (stripped.length % 2 !== 0) {
    throw new Error(`Invalid hex string of odd length (${stripped.length})`);
  }
  const out = new Uint8Array(stripped.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

// Structural check rather than `instanceof`: SDK-built txs may come from a
// different copy of @solana/web3.js. Only VersionedTransaction has `version`.
const isVersionedTx = (tx: Transaction | VersionedTransaction): tx is VersionedTransaction =>
  'version' in tx;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Confirms over plain HTTP polling. `connection.confirmTransaction` relies on a
// websocket subscription that can stall and then throw "block height
// exceeded" for a tx that actually landed — which strands a sent transfer.
// A tx is only reported as failed if the chain says it failed, or if its
// blockhash expired AND the chain has no record of it.
const waitForSolanaConfirmation = async (
  conn: Connection,
  sig: string,
  lastValidBlockHeight: number
): Promise<void> => {
  const deadline = Date.now() + SOLANA_CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    let failure: Error | undefined;
    try {
      const { value } = await conn.getSignatureStatuses([sig], { searchTransactionHistory: true });
      const status = value[0];
      if (status?.err) {
        failure = txFailedOnChain(`Solana transaction ${sig} failed: ${JSON.stringify(status.err)}`);
      } else if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
        return;
      } else if (!status && (await conn.getBlockHeight('confirmed')) > lastValidBlockHeight) {
        failure = txFailedOnChain(`Solana transaction ${sig} expired before it was confirmed`);
      }
    } catch {
      // RPC hiccup — keep polling until the deadline.
    }
    if (failure) throw failure;
    await sleep(SOLANA_CONFIRM_POLL_INTERVAL_MS);
  }
  // Still unknown after the deadline: don't fail. Callers keep tracking the
  // signature and later checks read chain state directly.
};

const parseSolanaTransaction = (b64: string): VersionedTransaction | Transaction => {
  const bytes = decodeBase64ToUint8(b64);
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
};

// Relay's Solana step payload uses the structured form documented at
// https://docs.relay.link/references/chain-support/solana — an array of
// instructions plus a list of address lookup table accounts to resolve at
// build time. We reconstruct the v0 message ourselves.
type RelayRawInstruction = {
  programId: string;
  keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  data: string; // hex-encoded
};

type RelayRawInstructionsPayload = {
  instructions: RelayRawInstruction[];
  addressLookupTableAddresses?: string[];
};

const isRelayRawInstructionsPayload = (
  v: unknown
): v is RelayRawInstructionsPayload => {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return Array.isArray(obj.instructions);
};

const buildInstruction = (raw: RelayRawInstruction): TransactionInstruction =>
  new TransactionInstruction({
    programId: new PublicKey(raw.programId),
    keys: raw.keys.map((k) => ({
      pubkey: new PublicKey(k.pubkey),
      isSigner: Boolean(k.isSigner),
      isWritable: Boolean(k.isWritable),
    })),
    data: Buffer.from(decodeHexToUint8(raw.data)),
  });

const resolveLookupTables = async (
  connection: Connection,
  addresses: string[]
): Promise<AddressLookupTableAccount[]> => {
  if (!addresses.length) return [];
  const results = await Promise.all(
    addresses.map((addr) => connection.getAddressLookupTable(new PublicKey(addr)))
  );
  return results
    .map((r) => r.value)
    .filter((v): v is AddressLookupTableAccount => v !== null);
};

export const useEvmSigner = (): EvmSigner | null => {
  const { isConnected } = useAccount();
  const switchChainMutation = useSwitchChain();
  const sendTxMutation = useSendTransaction();
  const signTypedMutation = useSignTypedData();
  const walletClient = useWalletClient();
  const config = useConfig();

  return useMemo<EvmSigner | null>(() => {
    if (!isConnected) return null;
    return {
      switchChain: async (chainId: number) => {
        await switchChainMutation.switchChainAsync({ chainId });
      },
      sendTransaction: async (req) => {
        const hash = await sendTxMutation.sendTransactionAsync({
          chainId: req.chainId,
          to: req.to,
          data: req.data,
          value: req.value,
          maxFeePerGas: req.maxFeePerGas,
          maxPriorityFeePerGas: req.maxPriorityFeePerGas,
        });
        return hash;
      },
      signTypedData: async (req) => {
        if (!walletClient.data) throw new Error('Wallet client not available');
        const sig = await signTypedMutation.signTypedDataAsync({
          domain: req.domain,
          types: req.types,
          primaryType: req.primaryType,
          message: req.message,
        } as Parameters<typeof signTypedMutation.signTypedDataAsync>[0]);
        return sig;
      },
      waitForReceipt: async (chainId, hash) => {
        const receipt = await waitForTransactionReceipt(config, {
          chainId: chainId as (typeof config.chains)[number]['id'],
          hash,
        });
        if (receipt.status !== 'success') {
          throw txFailedOnChain(`Transaction ${hash} reverted`);
        }
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, walletClient.data, config]);
};

export const useSvmSigner = (): SvmSigner | null => {
  const { connection } = useConnection();
  const wallet = useWallet();

  const sendBase64Tx = useCallback(
    async (b64: string): Promise<string> => {
      if (!wallet.connected || !wallet.publicKey) {
        throw new Error('Solana wallet not connected');
      }
      if (!wallet.signTransaction) {
        throw new Error('Wallet does not support signTransaction');
      }
      const tx = parseSolanaTransaction(b64);
      const signed = await wallet.signTransaction(tx);
      const signedTxBytes = signed.serialize();
      const sig = await (connection as Connection).sendRawTransaction(signedTxBytes, {
        skipPreflight: false,
      });
      await (connection as Connection).confirmTransaction(sig, 'confirmed').catch(() => {});
      return sig;
    },
    [connection, wallet]
  );

  const sendRawInstructions = useCallback(
    async (payload: unknown): Promise<string> => {
      if (!wallet.connected || !wallet.publicKey) {
        throw new Error('Solana wallet not connected');
      }
      if (!wallet.signTransaction) {
        throw new Error('Wallet does not support signTransaction');
      }

      let instructionsRaw: RelayRawInstruction[];
      let altAddresses: string[];

      if (Array.isArray(payload)) {
        instructionsRaw = payload as RelayRawInstruction[];
        altAddresses = [];
      } else if (isRelayRawInstructionsPayload(payload)) {
        instructionsRaw = payload.instructions;
        altAddresses = payload.addressLookupTableAddresses ?? [];
      } else {
        throw new Error('sendRawInstructions: unrecognised payload shape');
      }

      const instructions = instructionsRaw.map(buildInstruction);
      const altAccounts = await resolveLookupTables(connection as Connection, altAddresses);
      const { blockhash } = await (connection as Connection).getLatestBlockhash('confirmed');

      const message = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message(altAccounts);

      const tx = new VersionedTransaction(message);
      const signed = await wallet.signTransaction(tx);
      const sig = await (connection as Connection).sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
      });
      await (connection as Connection).confirmTransaction(sig, 'confirmed').catch(() => {});
      return sig;
    },
    [connection, wallet]
  );

  // The wallet signs first, then the extra keypairs. Phantom may rewrite a tx
  // before signing (Lighthouse guards), which would invalidate signatures
  // added before it.
  const signAndSendTx = useCallback(
    async (
      tx: Transaction | VersionedTransaction,
      extraSigners: Keypair[],
      onSent?: (signature: string) => void
    ): Promise<string> => {
      if (!wallet.connected || !wallet.publicKey) {
        throw new Error('Solana wallet not connected');
      }
      if (!wallet.signTransaction) {
        throw new Error('Wallet does not support signTransaction');
      }
      const conn = connection as Connection;
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
      if (isVersionedTx(tx)) {
        tx.message.recentBlockhash = blockhash;
      } else {
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        if (!tx.feePayer) tx.feePayer = wallet.publicKey;
      }

      const signed = await wallet.signTransaction(tx);
      if (extraSigners.length) {
        if (isVersionedTx(signed)) signed.sign(extraSigners);
        else signed.partialSign(...extraSigners);
      }

      const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      onSent?.(sig);
      await waitForSolanaConfirmation(conn, sig, lastValidBlockHeight);
      return sig;
    },
    [connection, wallet]
  );

  return useMemo<SvmSigner | null>(() => {
    if (!wallet.connected) return null;
    return { sendBase64Tx, sendRawInstructions, signAndSendTx };
  }, [wallet.connected, sendBase64Tx, sendRawInstructions, signAndSendTx]);
};
