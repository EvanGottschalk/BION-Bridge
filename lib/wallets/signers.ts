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
} from '@solana/web3.js';
import type { EvmSigner, SvmSigner } from '@/lib/relay/execute';

const decodeBase64ToUint8 = (b64: string): Uint8Array => {
  if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(b64, 'base64'));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
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
      const tx = parseSolanaTransaction(b64);
      let signedTxBytes: Uint8Array;

      if (tx instanceof VersionedTransaction) {
        if (!wallet.signTransaction) {
          throw new Error('Wallet does not support signTransaction');
        }
        const signed = await wallet.signTransaction(tx);
        signedTxBytes = signed.serialize();
      } else {
        if (!wallet.signTransaction) {
          throw new Error('Wallet does not support signTransaction');
        }
        const signed = await wallet.signTransaction(tx);
        signedTxBytes = signed.serialize();
      }

      const sig = await (connection as Connection).sendRawTransaction(signedTxBytes, {
        skipPreflight: false,
      });
      await (connection as Connection).confirmTransaction(sig, 'confirmed').catch(() => {});
      return sig;
    },
    [connection, wallet]
  );

  return useMemo<SvmSigner | null>(() => {
    if (!wallet.connected) return null;
    return { sendBase64Tx };
  }, [wallet.connected, sendBase64Tx]);
};
