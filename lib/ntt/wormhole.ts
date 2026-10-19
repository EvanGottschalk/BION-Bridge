// Wormhole SDK context + NTT executor route, built from NTT_BRIDGE_INFO.
// This module (and everything importing it) is only ever loaded through a
// dynamic import from lib/bridge/router.ts, so Relay-only users never
// download the SDK.

import { Wormhole, type Chain, type Network } from '@wormhole-foundation/sdk-connect';
import { EvmPlatform } from '@wormhole-foundation/sdk-evm';
import { SolanaPlatform } from '@wormhole-foundation/sdk-solana';
import { register as registerEvmNtt } from '@wormhole-foundation/sdk-evm-ntt';
import { register as registerSolanaNtt } from '@wormhole-foundation/sdk-solana-ntt';
import { nttExecutorRoute, type NttRoute } from '@wormhole-foundation/sdk-route-ntt';
import { NTT_BRIDGE_INFO, type ChainKey } from '@/config/blockchain_config';
import { ALL_CHAINS } from '@/config/active_chains';
import { resolveRpcUrls } from '@/config/chain_info';
import {
  NTT_BPS_DENOMINATOR,
  NTT_REFERRER_ADDRESSES,
  NTT_REFERRER_FEE_BPS,
  WORMHOLE_CHAIN_BY_CHAINKEY,
} from '@/config/ntt_config';

registerEvmNtt();
registerSolanaNtt();

export type WhNetwork = Extract<Network, 'Mainnet' | 'Testnet'>;

const isNetworkChain = (chainKey: ChainKey, network: WhNetwork): boolean => {
  const chain = ALL_CHAINS.find((c) => c.chainKey === chainKey);
  return Boolean(chain) && chain!.isTestnet === (network === 'Testnet');
};

export const toWormholeChain = (chainKey: ChainKey): Chain => {
  const name = WORMHOLE_CHAIN_BY_CHAINKEY[chainKey];
  if (!name) throw new Error(`No Wormhole chain mapping for ${chainKey} (config/ntt_config.ts)`);
  return name as Chain;
};

/** Our ChainKey for a Wormhole chain name on a given network. */
export const fromWormholeChain = (chain: Chain, network: WhNetwork): ChainKey | undefined =>
  (Object.keys(WORMHOLE_CHAIN_BY_CHAINKEY) as ChainKey[]).find(
    (k) => WORMHOLE_CHAIN_BY_CHAINKEY[k] === chain && isNetworkChain(k, network)
  );

const whCache: Partial<Record<WhNetwork, Wormhole<WhNetwork>>> = {};

// RPCs come from config/chain_info.ts (with API keys substituted) so the SDK
// reads chain state through the same endpoints as the rest of the app.
export const getWormhole = (network: WhNetwork): Wormhole<WhNetwork> => {
  const cached = whCache[network];
  if (cached) return cached;
  const chains: Record<string, { rpc: string }> = {};
  for (const c of ALL_CHAINS) {
    if (c.isTestnet !== (network === 'Testnet')) continue;
    const whChain = WORMHOLE_CHAIN_BY_CHAINKEY[c.chainKey];
    const rpc = resolveRpcUrls(c.rpcUrls)[0];
    if (whChain && rpc) chains[whChain] = { rpc };
  }
  const wh = new Wormhole(network, [EvmPlatform, SolanaPlatform], { chains });
  whCache[network] = wh;
  return wh;
};

const buildTokenConfigs = (network: WhNetwork): Record<string, NttRoute.TokenConfig[]> => {
  const tokens: Record<string, NttRoute.TokenConfig[]> = {};
  for (const [symbol, deployment] of Object.entries(NTT_BRIDGE_INFO)) {
    if (deployment.network !== network) continue;
    tokens[symbol] = (Object.keys(deployment.chains) as ChainKey[]).map((chainKey) => {
      const entry = deployment.chains[chainKey]!;
      return {
        chain: toWormholeChain(chainKey),
        token: entry.tokenContractAddress,
        manager: entry.NTTcontractAddress,
        transceiver: [{ type: 'wormhole', address: entry.NTTtransceiverAddress }],
      };
    });
  }
  return tokens;
};

const routeCache: Partial<Record<WhNetwork, ReturnType<typeof nttExecutorRoute>>> = {};

// Our referrer fee: NTT_REFERRER_FEE_BPS of the (trimmed) transfer amount, in
// the bridged token, paid to the fee recipient for the source chain.
export const getNttRouteClass = (network: WhNetwork) => {
  const cached = routeCache[network];
  if (cached) return cached;
  const RouteClass = nttExecutorRoute({
    ntt: { tokens: buildTokenConfigs(network) },
    getFee: async ({ amount, sourceChain }) => {
      const chainKey = fromWormholeChain(sourceChain, network);
      const referrerAddress = chainKey ? NTT_REFERRER_ADDRESSES[chainKey] : undefined;
      if (!referrerAddress) {
        throw new Error(`No fee recipient configured for ${sourceChain} (FEE_RECIPIENT_ADDRESSES)`);
      }
      const transferTokenFee =
        (amount * BigInt(NTT_REFERRER_FEE_BPS)) / BigInt(NTT_BPS_DENOMINATOR);
      return { transferTokenFee, nativeTokenFee: 0n, referrerAddress };
    },
  });
  routeCache[network] = RouteClass;
  return RouteClass;
};
