import {
  RELAY_API_BASE,
  RELAY_QUOTE_PATH,
  RELAY_STATUS_PATH,
  RELAY_CURRENCIES_PATH,
  RELAY_CHAINS_PATH,
  RELAY_EXECUTE_PERMITS_PATH,
  relayAppFeesBalancePath,
  relayAppFeesClaimPath,
} from '@/config/relay_config';
import type {
  RelayQuoteRequest,
  RelayQuoteResponse,
  RelayStatusResponse,
  RelayCurrenciesRequest,
  RelayCurrencyListResponse,
  RelayChainsResponse,
} from './types';

class RelayApiError extends Error {
  constructor(public status: number, public body: string, message?: string) {
    super(message ?? `Relay API ${status}: ${body}`);
    this.name = 'RelayApiError';
  }
}

const buildHeaders = (init?: HeadersInit): Headers => {
  const h = new Headers(init);
  h.set('Content-Type', 'application/json');
  const key = process.env.NEXT_PUBLIC_RELAY_API_KEY;
  if (key) h.set('Authorization', `Bearer ${key}`);
  return h;
};

const ensureOk = async (res: Response): Promise<void> => {
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  throw new RelayApiError(res.status, body);
};

const post = async <T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> => {
  const res = await fetch(`${RELAY_API_BASE}${path}`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
    signal,
  });
  await ensureOk(res);
  return (await res.json()) as T;
};

const get = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
  const res = await fetch(`${RELAY_API_BASE}${path}`, {
    method: 'GET',
    headers: buildHeaders(),
    signal,
  });
  await ensureOk(res);
  return (await res.json()) as T;
};

export const relayApi = {
  getQuote: (req: RelayQuoteRequest, signal?: AbortSignal) =>
    post<RelayQuoteResponse>(RELAY_QUOTE_PATH, req, signal),

  getStatus: (requestId: string, signal?: AbortSignal) =>
    get<RelayStatusResponse>(
      `${RELAY_STATUS_PATH}?requestId=${encodeURIComponent(requestId)}`,
      signal
    ),

  getChains: (signal?: AbortSignal) => get<RelayChainsResponse>(RELAY_CHAINS_PATH, signal),

  searchCurrencies: (req: RelayCurrenciesRequest, signal?: AbortSignal) =>
    post<RelayCurrencyListResponse>(RELAY_CURRENCIES_PATH, req, signal),

  getAppFeeBalances: (wallet: string, signal?: AbortSignal) =>
    get<unknown>(relayAppFeesBalancePath(wallet), signal),

  claimAppFees: (
    wallet: string,
    body: { chainId: number; currency: string; recipient: string; amount?: string },
    signal?: AbortSignal
  ) => post<unknown>(relayAppFeesClaimPath(wallet), body, signal),

  postPermit: (
    endpoint: string,
    body: { kind: string; requestId: string },
    signal?: AbortSignal
  ) => post<unknown>(endpoint || RELAY_EXECUTE_PERMITS_PATH, body, signal),
};

export { RelayApiError };
