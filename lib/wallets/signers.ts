'use client';

import { useCallback, useMemo } from 'react';
import {
  useAccount,
  useSwitchChain,
  useSendTransaction,
  useSignTypedData,
  useWalletClient,
} from 'wagmi';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  Connection,
  VersionedTransaction,
  Transaction,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  AddressLookupTableAccount,
} from '@solana/web3.js';
import type { EvmSigner, SvmSigner } from '@/lib/relay/execute';

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, walletClient.data]);
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

  return useMemo<SvmSigner | null>(() => {
    if (!wallet.connected) return null;
    return { sendBase64Tx, sendRawInstructions };
  }, [wallet.connected, sendBase64Tx, sendRawInstructions]);
};
