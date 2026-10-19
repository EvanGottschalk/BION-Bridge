// Wormhole NTT integration constants. Deployments themselves live in
// NTT_BRIDGE_INFO (config/blockchain_config.ts); this file holds the shared
// knobs every NTT route uses. See docs/dev_notes/plans/2 - NTT Bridge Integration Plan.md.

import type { ChainKey } from './blockchain_config';
import { FEE_RECIPIENT_ADDRESSES, UNIVERSAL_FEES } from './fees_config';

// Wormhole SDK chain names for each of our ChainKeys. Solana mainnet and devnet
// share the name 'Solana'; the Wormhole network ('Mainnet' | 'Testnet') tells
// them apart.
export const WORMHOLE_CHAIN_BY_CHAINKEY: Partial<Record<ChainKey, string>> = {
  ETH_MAINNET: 'Ethereum',
  BASE_MAINNET: 'Base',
  SOLANA_MAINNET: 'Solana',
  ETH_SEPOLIA: 'Sepolia',
  BASE_SEPOLIA: 'BaseSepolia',
  SOLANA_DEVNET: 'Solana',
};

// NTT trims amounts on the wire to min(8, token decimals). Inputs are capped
// to this precision so users never lose dust.
export const NTT_TRIMMED_DECIMALS = 8;

// Our referrer fee on NTT routes: same as Relay, derived from UNIVERSAL_FEES.ALL
// (a percentage). 0.5% → 50 bps. Charged in the bridged token on the source
// chain and paid to NTT_REFERRER_ADDRESSES[source chain].
export const NTT_REFERRER_FEE_BPS = Math.round(UNIVERSAL_FEES.ALL * 100);
export const NTT_BPS_DENOMINATOR = 10_000;
export const NTT_REFERRER_ADDRESSES: Partial<Record<ChainKey, string>> = FEE_RECIPIENT_ADDRESSES;

export const NTT_QUOTE_DEBOUNCE_MS = 400;
export const NTT_QUOTE_REFRESH_MS = 30_000; // Executor signed quotes expire; refresh well inside that window

// Tracking. route.track() is a single pass, so we loop it.
export const NTT_TRACK_POLL_INTERVAL_MS = 5_000;
export const NTT_VAA_FETCH_TIMEOUT_MS = 60_000; // per-iteration wait for the Guardian VAA
export const NTT_TRACK_TIMEOUT_MS = 60 * 60_000; // Base → Solana waits on Base finality (~15–30 min)
export const NTT_MANUAL_REDEEM_AFTER_MS = 10 * 60_000; // offer "Redeem manually" if the Executor hasn't delivered by then

// Pending transfers are remembered per viewer so tracking resumes after a reload.
export const NTT_PENDING_STORAGE_KEY = 'aphid.ntt.pendingTransfers';
export const NTT_PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

export const WORMHOLESCAN_TX_URL = (txHash: string, network: 'Mainnet' | 'Testnet'): string =>
  `https://wormholescan.io/#/tx/${txHash}?network=${network}`;
