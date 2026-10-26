// Picks the bridging provider for a route. The only place that decides
// Relay vs NTT.

import { findNttPair } from '@/lib/ntt/registry';
import { RELAY_QUOTE_DEBOUNCE_MS, RELAY_QUOTE_REFRESH_MS } from '@/config/relay_config';
import { NTT_QUOTE_DEBOUNCE_MS, NTT_QUOTE_REFRESH_MS } from '@/config/ntt_config';
import { relayProvider } from './providers/relay';
import type { BridgeProvider, BridgeProviderId, BridgeRoute } from './types';

type RouteSides = Pick<BridgeRoute, 'fromChain' | 'toChain'> & {
  fromToken?: { address: string } | null;
  toToken?: { address: string } | null;
};

/** NTT when both tokens belong to the same NTT deployment; Relay otherwise. */
export const selectProviderId = (route: RouteSides): BridgeProviderId =>
  findNttPair(route.fromChain, route.fromToken?.address, route.toChain, route.toToken?.address)
    ? 'ntt'
    : 'relay';

// The NTT provider pulls in the Wormhole SDK, so it is code-split and only
// downloaded the first time an NTT route is quoted.
let nttProviderPromise: Promise<BridgeProvider> | null = null;

export const loadProvider = (id: BridgeProviderId): Promise<BridgeProvider> => {
  if (id === 'relay') return Promise.resolve(relayProvider);
  nttProviderPromise ??= import('./providers/ntt').then((m) => m.nttProvider);
  return nttProviderPromise;
};

// On-chain redemption status for the past-transactions list (same NTT chunk).
export const loadNttTransferStatus = () => import('./providers/ntt').then((m) => m.getNttTransferStatus);

export const QUOTE_TIMINGS: Record<BridgeProviderId, { debounceMs: number; refreshMs: number }> = {
  relay: { debounceMs: RELAY_QUOTE_DEBOUNCE_MS, refreshMs: RELAY_QUOTE_REFRESH_MS },
  ntt: { debounceMs: NTT_QUOTE_DEBOUNCE_MS, refreshMs: NTT_QUOTE_REFRESH_MS },
};
