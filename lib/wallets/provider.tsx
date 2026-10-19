'use client';

import { useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import '@rainbow-me/rainbowkit/styles.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import { wagmiConfig } from './evm';
import { useSolanaEndpoint, useSolanaWallets } from './svm';
import { RAINBOW_KIT_THEME_ACCENT } from '@/config/ui_config';
import { NetworkModeProvider, useNetworkMode } from '@/lib/network/network-mode';

// NetworkModeProvider sits outermost because the Solana endpoint depends on
// Test Mode.
export function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <NetworkModeProvider>
      <WalletStack>{children}</WalletStack>
    </NetworkModeProvider>
  );
}

function WalletStack({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const { testMode } = useNetworkMode();
  const endpoint = useSolanaEndpoint(testMode);
  const wallets = useSolanaWallets();

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: RAINBOW_KIT_THEME_ACCENT,
            accentColorForeground: '#FFFFFF',
            borderRadius: 'large',
            overlayBlur: 'small',
          })}
        >
          <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
              <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
          </ConnectionProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
