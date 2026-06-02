'use client';

import { createConfig, http } from 'wagmi';
import { mainnet, base } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { resolveRpcUrls, ETH_MAINNET, BASE_MAINNET } from '@/config/chain_info';
import { APP_NAME } from '@/config/ui_config';

const WC_PROJECT_ID_ENV = 'NEXT_PUBLIC_WC_PROJECT_ID';

const firstRpc = (urls: string[]): string | undefined => resolveRpcUrls(urls)[0];

const ethRpc = firstRpc(ETH_MAINNET.rpcUrls);
const baseRpc = firstRpc(BASE_MAINNET.rpcUrls);

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

// Use RainbowKit's getDefaultConfig when a WalletConnect project id is
// available. Otherwise fall back to a connector-less wagmi config so the app
// still renders in environments where the env var is missing.
export const wagmiConfig = projectId
  ? getDefaultConfig({
      appName: APP_NAME,
      projectId,
      chains: [mainnet, base],
      transports: {
        [mainnet.id]: http(ethRpc),
        [base.id]: http(baseRpc),
      },
      ssr: true,
    })
  : createConfig({
      chains: [mainnet, base],
      transports: {
        [mainnet.id]: http(ethRpc),
        [base.id]: http(baseRpc),
      },
      ssr: true,
    });

export const WC_PROJECT_ID_HINT = WC_PROJECT_ID_ENV;
