import type { ChainTokens, TokenInfo } from './types';
import * as ethTokens from './eth_tokens';
import * as baseTokens from './base_tokens';
import * as solanaTokens from './solana_tokens';
import * as ethSepoliaTokens from './eth_sepolia_testnet_tokens';
import * as baseSepoliaTokens from './base_testnet_sepolia_tokens';
import * as solanaDevnetTokens from './solana_devnet_tokens';
import { ALL_CHAINS, type ActiveChainKey } from '../active_chains';
import { NATIVE_EVM_ADDRESS, NATIVE_SOL_ADDRESS } from '../relay_config';

export type { TokenInfo, ChainTokens } from './types';

const buildMap = (mod: Record<string, unknown>): ChainTokens => {
  const acc: ChainTokens = {};
  for (const value of Object.values(mod)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      'symbol' in value &&
      'address' in value
    ) {
      const t = value as TokenInfo;
      acc[t.symbol.toUpperCase()] = t;
    }
  }
  return acc;
};

export const TOKENS_BY_CHAIN: Record<ActiveChainKey, ChainTokens> = {
  ethereum: buildMap(ethTokens),
  base: buildMap(baseTokens),
  solana: buildMap(solanaTokens),
  sepolia: buildMap(ethSepoliaTokens),
  baseSepolia: buildMap(baseSepoliaTokens),
  solanaDevnet: buildMap(solanaDevnetTokens),
};

const NATIVE_ETH: TokenInfo = {
  symbol: 'ETH',
  name: 'Ether',
  address: NATIVE_EVM_ADDRESS,
  decimals: 18,
};

const NATIVE_SOL: TokenInfo = {
  symbol: 'SOL',
  name: 'Solana',
  address: NATIVE_SOL_ADDRESS,
  decimals: 9,
};

// Native tokens are surfaced as first-class entries even though they have no
// ERC-20-style address. We synthesise them here so the selector can render them.
const NATIVE_TOKENS: Record<ActiveChainKey, TokenInfo> = {
  ethereum: NATIVE_ETH,
  base: NATIVE_ETH,
  solana: NATIVE_SOL,
  sepolia: NATIVE_ETH,
  baseSepolia: NATIVE_ETH,
  solanaDevnet: NATIVE_SOL,
};

for (const chain of ALL_CHAINS) {
  const map = TOKENS_BY_CHAIN[chain.key];
  const nativeSymbol = NATIVE_TOKENS[chain.key].symbol;
  if (!map[nativeSymbol]) {
    map[nativeSymbol] = NATIVE_TOKENS[chain.key];
  }
}

export const getNativeToken = (chain: ActiveChainKey): TokenInfo => NATIVE_TOKENS[chain];

export const FEATURED_TOKENS_BY_CHAIN: Record<ActiveChainKey, string[]> = {
  ethereum: ['ETH', 'USDC', 'USDT', 'WETH', 'WBTC', 'DAI'],
  base: ['ETH', 'USDC', 'WETH', 'CBETH', 'DAI', 'WBTC'],
  solana: ['SOL', 'USDC', 'USDT', 'WSOL', 'WETH', 'WBTC'],
  sepolia: ['ETH', 'USDC', 'WETH', 'DAI'],
  baseSepolia: ['ETH', 'BRDGTST', 'USDC', 'WETH'],
  solanaDevnet: ['SOL', 'BRDGTST'],
};

export const getTokenList = (chain: ActiveChainKey): TokenInfo[] =>
  Object.values(TOKENS_BY_CHAIN[chain]);

export const findToken = (
  chain: ActiveChainKey,
  symbolOrAddress: string
): TokenInfo | undefined => {
  const map = TOKENS_BY_CHAIN[chain];
  const upper = symbolOrAddress.toUpperCase();
  if (map[upper]) return map[upper];
  const lowerAddr = symbolOrAddress.toLowerCase();
  return Object.values(map).find(
    (t) => t.address.toLowerCase() === lowerAddr || t.address === symbolOrAddress
  );
};

export const getFeaturedTokens = (chain: ActiveChainKey): TokenInfo[] => {
  const map = TOKENS_BY_CHAIN[chain];
  const featured = FEATURED_TOKENS_BY_CHAIN[chain];
  return featured
    .map((sym) => map[sym.toUpperCase()])
    .filter((t): t is TokenInfo => Boolean(t));
};
