'use client';

import { useMemo } from 'react';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { resolveRpcUrls, SOLANA_MAINNET } from '@/config/chain_info';

export const useSolanaEndpoint = (): string => {
  return useMemo(() => {
    const resolved = resolveRpcUrls(SOLANA_MAINNET.rpcUrls);
    return resolved[0] ?? 'https://api.mainnet-beta.solana.com/';
  }, []);
};

export const useSolanaWallets = () =>
  useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
