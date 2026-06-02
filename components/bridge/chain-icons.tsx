'use client';

import type { ReactElement } from 'react';
import type { ActiveChain, ActiveChainKey } from '@/config/active_chains';

type IconProps = { className?: string };

export const SolanaIcon = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg viewBox="0 0 128 128" className={className} fill="none">
    <circle cx="64" cy="64" r="64" fill="#000" />
    <defs>
      <linearGradient id="sol-a" x1="20" y1="100" x2="108" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#9945FF" />
        <stop offset="0.5" stopColor="#14F195" />
        <stop offset="1" stopColor="#00C2FF" />
      </linearGradient>
    </defs>
    <path
      d="M36.3 85.1a2.1 2.1 0 011.5-.6h56.9c.9 0 1.4 1.1.7 1.8l-11 11a2.1 2.1 0 01-1.5.6H26a1 1 0 01-.7-1.8l11-11zM36.3 31.7a2.1 2.1 0 011.5-.6h56.9c.9 0 1.4 1.1.7 1.8l-11 11a2.1 2.1 0 01-1.5.6H26a1 1 0 01-.7-1.8l11-11zM83.9 58.2a2.1 2.1 0 00-1.5-.6H25.5a1 1 0 00-.7 1.8l11 11c.4.4.9.6 1.5.6H94a1 1 0 00.7-1.8l-10.8-11z"
      fill="url(#sol-a)"
    />
  </svg>
);

export const BaseIcon = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg viewBox="0 0 128 128" className={className} fill="none">
    <circle cx="64" cy="64" r="64" fill="#0052FF" />
    <path
      d="M64.1 108C39.8 108 20 88.1 20 63.9 20 39.6 39.8 20 64.1 20c22.4 0 41 16.7 43.8 38.3H72.6c-2.5-10.8-12.2-18.8-23.7-18.8C35.4 39.5 24.7 50.7 24.7 64s10.7 24.5 24.2 24.5c11.5 0 21.2-8 23.7-18.8h35.3C105.1 91.3 86.5 108 64.1 108z"
      fill="#fff"
    />
  </svg>
);

export const EthereumIcon = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg viewBox="0 0 128 128" className={className} fill="none">
    <circle cx="64" cy="64" r="64" fill="#627EEA" />
    <path d="M64 16v36.4l30.7 13.7L64 16z" fill="#fff" fillOpacity=".6" />
    <path d="M64 16L33.3 66.1 64 52.4V16z" fill="#fff" />
    <path d="M64 89.4v22.6l30.7-42.5L64 89.4z" fill="#fff" fillOpacity=".6" />
    <path d="M64 112V89.4L33.3 69.5 64 112z" fill="#fff" />
    <path d="M64 83.7l30.7-17.6L64 52.4v31.3z" fill="#fff" fillOpacity=".2" />
    <path d="M33.3 66.1L64 83.7V52.4L33.3 66.1z" fill="#fff" fillOpacity=".6" />
  </svg>
);

export const CHAIN_ICONS: Record<ActiveChainKey, (p: IconProps) => ReactElement> = {
  ethereum: EthereumIcon,
  base: BaseIcon,
  solana: SolanaIcon,
};

export const ChainIcon = ({
  chainKey,
  className,
}: {
  chainKey: ActiveChainKey;
  className?: string;
}) => {
  const Icon = CHAIN_ICONS[chainKey];
  return <Icon className={className} />;
};

export const renderChainBadge = (chain: ActiveChain) => {
  const Icon = CHAIN_ICONS[chain.iconKey];
  return <Icon className="w-5 h-5" />;
};
