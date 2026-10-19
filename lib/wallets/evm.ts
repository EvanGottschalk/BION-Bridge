'use client';

import { createConfig, http } from 'wagmi';
import { mainnet, base, sepolia, baseSepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  resolveRpcUrls,
  ETH_MAINNET,
  BASE_MAINNET,
  ETH_SEPOLIA,
  BASE_SEPOLIA,
} from '@/config/chain_info';
import { APP_NAME } from '@/config/ui_config';

const WC_PROJECT_ID_ENV = 'NEXT_PUBLIC_WC_PROJECT_ID';

const firstRpc = (urls: string[]): string | undefined => resolveRpcUrls(urls)[0];

// All four EVM chains are always registered so flipping Test Mode never
// remounts wagmi/RainbowKit; the UI filters which chains are offered, and
// every step calls switchChain before sending.
const chains = [mainnet, base, sepolia, baseSepolia] as const;

const transports = {
  [mainnet.id]: http(firstRpc(ETH_MAINNET.rpcUrls)),
  [base.id]: http(firstRpc(BASE_MAINNET.rpcUrls)),
  [sepolia.id]: http(firstRpc(ETH_SEPOLIA.rpcUrls)),
  [baseSepolia.id]: http(firstRpc(BASE_SEPOLIA.rpcUrls)),
};

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

// Use RainbowKit's getDefaultConfig when a WalletConnect project id is
// available. Otherwise fall back to a connector-less wagmi config so the app
// still renders in environments where the env var is missing.
export const wagmiConfig = projectId
  ? getDefaultConfig({
      appName: APP_NAME,
      projectId,
      chains,
      transports,
      ssr: true,
    })
  : createConfig({
      chains,
      transports,
      ssr: true,
    });

export const WC_PROJECT_ID_HINT = WC_PROJECT_ID_ENV;
