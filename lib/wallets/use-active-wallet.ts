'use client';

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import { type ActiveChainKey, getActiveChain } from '@/config/active_chains';

export type ActiveWalletInfo = {
  evm: { address: string | undefined; isConnected: boolean };
  svm: { address: string | undefined; isConnected: boolean };
};

export const useActiveWallet = (): ActiveWalletInfo => {
  const evm = useAccount();
  const svm = useWallet();

  return useMemo(
    () => ({
      evm: {
        address: evm.address,
        isConnected: evm.isConnected,
      },
      svm: {
        address: svm.publicKey ? svm.publicKey.toBase58() : undefined,
        isConnected: svm.connected,
      },
    }),
    [evm.address, evm.isConnected, svm.publicKey, svm.connected]
  );
};

export const useWalletForChain = (chain: ActiveChainKey): {
  address: string | undefined;
  isConnected: boolean;
} => {
  const w = useActiveWallet();
  const vm = getActiveChain(chain).vmType;
  return vm === 'evm' ? w.evm : w.svm;
};
