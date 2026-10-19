'use client';

import { useMemo } from 'react';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { resolveRpcUrls, SOLANA_MAINNET, SOLANA_DEVNET } from '@/config/chain_info';

// Test Mode swaps the Connection to devnet. The wallet adapter stays connected
// across the switch; we broadcast through this connection ourselves.
export const useSolanaEndpoint = (testMode: boolean): string => {
  return useMemo(() => {
    const chain = testMode ? SOLANA_DEVNET : SOLANA_MAINNET;
    const resolved = resolveRpcUrls(chain.rpcUrls);
    return resolved[0] ?? chain.rpcUrls[chain.rpcUrls.length - 1];
  }, [testMode]);
};

export const useSolanaWallets = () =>
  useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
