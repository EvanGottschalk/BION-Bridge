'use client';

import type { ReactNode } from 'react';
import { WalletProviders } from '@/lib/wallets/provider';

export function Providers({ children }: { children: ReactNode }) {
  return <WalletProviders>{children}</WalletProviders>;
}
