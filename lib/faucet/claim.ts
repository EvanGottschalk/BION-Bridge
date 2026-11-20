import { FAUCET_API_ROUTE, FAUCET_COPY, FAUCET_ERRORS, type FaucetToken } from '@/config/faucet_config';
import type {
  FaucetClaimRequest,
  FaucetClaimResponse,
  FaucetClaimSuccess,
  FaucetErrorCode,
  FaucetStatusResponse,
} from './types';

export type FaucetClaimResult = Omit<FaucetClaimSuccess, 'ok'>;

export class FaucetClaimError extends Error {
  constructor(
    message: string,
    public readonly code: FaucetErrorCode,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'FaucetClaimError';
  }
}

// Asks the claim route (app/api/faucet/claim/route.ts) to send `token` to
// `recipient`. Throws FaucetClaimError with a Dorothy-ready message on failure.
export async function requestFaucetClaim(token: FaucetToken, recipient: string): Promise<FaucetClaimResult> {
  const request: FaucetClaimRequest = { tokenId: token.id, recipient };
  let data: FaucetClaimResponse | null = null;
  try {
    const res = await fetch(FAUCET_API_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    data = (await res.json().catch(() => null)) as FaucetClaimResponse | null;
  } catch {
    // network failure, handled below
  }
  if (!data) throw new FaucetClaimError(FAUCET_ERRORS.network, 'network');
  if (!data.ok) throw new FaucetClaimError(data.message, data.code, data.retryAfterSeconds);
  const { ok: _ok, ...result } = data;
  return result;
}

// Seconds until `recipient` can claim `token` again; null if they can claim
// now. Throws if the status couldn't be read.
export async function fetchFaucetCooldown(token: FaucetToken, recipient: string): Promise<number | null> {
  const query = new URLSearchParams({ tokenId: token.id, recipient });
  const res = await fetch(`${FAUCET_API_ROUTE}?${query}`, { cache: 'no-store' });
  const data = (await res.json()) as FaucetStatusResponse;
  if (!data.ok) throw new FaucetClaimError(data.message, data.code);
  return data.cooldownSeconds;
}

// Seconds → "5h 12m" / "3m", rounded up to the next minute.
export function formatWait(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return FAUCET_COPY.duration(Math.floor(minutes / 60), minutes % 60);
}
