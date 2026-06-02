// Relay HTTP API + integration constants. All literal values for the Relay
// integration live here so components and lib code stay free of magic numbers
// and URLs (see CLAUDE.md Non-Negotiable Rule #1).

export const RELAY_API_BASE = 'https://api.relay.link';
export const RELAY_QUOTE_PATH = '/quote/v2';
export const RELAY_STATUS_PATH = '/intents/status/v3';
export const RELAY_CURRENCIES_PATH = '/currencies/v2';
export const RELAY_CHAINS_PATH = '/chains';
export const RELAY_REQUESTS_PATH = '/requests/v2';
export const RELAY_EXECUTE_PERMITS_PATH = '/execute/permits';

export const relayAppFeesBalancePath = (wallet: string) => `/app-fees/${wallet}/balances`;
export const relayAppFeesClaimPath = (wallet: string) => `/app-fees/${wallet}/claim`;

export const RELAY_API_KEY_ENV = 'NEXT_PUBLIC_RELAY_API_KEY';

export const RELAY_STATUS_POLL_INTERVAL_MS = 1000;
export const RELAY_STATUS_POLL_TIMEOUT_MS = 10 * 60 * 1000;

export const RELAY_DEFAULT_SLIPPAGE_BPS: number | null = null;
export const RELAY_QUOTE_DEBOUNCE_MS = 400;
export const RELAY_QUOTE_REFRESH_MS = 20_000;

export const RELAY_DEFAULT_TRADE_TYPE = 'EXACT_INPUT' as const;

// 0.5% — derived from UNIVERSAL_FEES.ALL = 0.5 in fees_config.ts. Subject to
// confirmation with product before launch.
export const RELAY_APP_FEE_BPS = 50;

// Sentinel addresses recognised by Relay for native gas tokens.
export const NATIVE_EVM_ADDRESS = '0x0000000000000000000000000000000000000000';
export const NATIVE_SOL_ADDRESS = '11111111111111111111111111111111';

// Terminal statuses for /intents/status/v3 polling.
export const RELAY_TERMINAL_STATUSES = ['success', 'failure', 'refunded'] as const;

export const RELAY_TOKEN_SEARCH_DEBOUNCE_MS = 250;
export const RELAY_TOKEN_SEARCH_LIMIT = 20;
