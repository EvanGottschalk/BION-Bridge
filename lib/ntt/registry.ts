// Config-only view of NTT_BRIDGE_INFO. No Wormhole SDK imports here, so the UI
// can ask "is this an NTT token?" without downloading the SDK.

import {
  NTT_BRIDGE_INFO,
  type ChainKey,
  type NttChainDeployment,
  type NttDeployment,
} from '@/config/blockchain_config';
import {
  getActiveChain,
  getActiveChainByChainKey,
  type ActiveChainKey,
} from '@/config/active_chains';
import { TOKENS_BY_CHAIN, type TokenInfo } from '@/config/token_info';

export type NttChainMatch = {
  symbol: string;
  deployment: NttDeployment;
  chain: ActiveChainKey;
  chainKey: ChainKey;
  entry: NttChainDeployment;
};

export type NttPair = {
  symbol: string;
  deployment: NttDeployment;
  src: NttChainMatch;
  dst: NttChainMatch;
};

// EVM addresses compare case-insensitively; Solana base58 is case-sensitive.
const sameAddress = (chain: ActiveChainKey, a: string, b: string): boolean =>
  getActiveChain(chain).vmType === 'evm' ? a.toLowerCase() === b.toLowerCase() : a === b;

const networkMatches = (deployment: NttDeployment, chain: ActiveChainKey): boolean =>
  deployment.network === (getActiveChain(chain).isTestnet ? 'Testnet' : 'Mainnet');

export const findNttChainEntry = (
  chain: ActiveChainKey,
  tokenAddress: string | undefined
): NttChainMatch | undefined => {
  if (!tokenAddress) return undefined;
  const chainKey = getActiveChain(chain).chainKey;
  for (const [symbol, deployment] of Object.entries(NTT_BRIDGE_INFO)) {
    if (!networkMatches(deployment, chain)) continue;
    const entry = deployment.chains[chainKey];
    if (entry && sameAddress(chain, entry.tokenContractAddress, tokenAddress)) {
      return { symbol, deployment, chain, chainKey, entry };
    }
  }
  return undefined;
};

export const isNttToken = (chain: ActiveChainKey, tokenAddress: string | undefined): boolean =>
  findNttChainEntry(chain, tokenAddress) !== undefined;

/** Both sides belong to the same NTT deployment, on different chains. */
export const findNttPair = (
  fromChain: ActiveChainKey,
  fromAddress: string | undefined,
  toChain: ActiveChainKey,
  toAddress: string | undefined
): NttPair | undefined => {
  if (fromChain === toChain) return undefined;
  const src = findNttChainEntry(fromChain, fromAddress);
  const dst = findNttChainEntry(toChain, toAddress);
  if (!src || !dst || src.symbol !== dst.symbol) return undefined;
  return { symbol: src.symbol, deployment: src.deployment, src, dst };
};

/** Chains (as UI keys) that the given deployment spans. */
export const getNttChains = (symbol: string): ActiveChainKey[] => {
  const deployment = NTT_BRIDGE_INFO[symbol];
  if (!deployment) return [];
  return (Object.keys(deployment.chains) as ChainKey[])
    .map((k) => getActiveChainByChainKey(k)?.key)
    .filter((k): k is ActiveChainKey => Boolean(k));
};

/** The TokenInfo for a deployment's token on a given chain, from config/token_info. */
export const getNttTokenInfo = (chain: ActiveChainKey, symbol: string): TokenInfo | undefined => {
  const entry = NTT_BRIDGE_INFO[symbol]?.chains[getActiveChain(chain).chainKey];
  if (!entry) return undefined;
  return Object.values(TOKENS_BY_CHAIN[chain]).find((t) =>
    sameAddress(chain, t.address, entry.tokenContractAddress)
  );
};
