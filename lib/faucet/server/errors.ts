import 'server-only';
import { FAUCET_DRY_ERROR_PATTERN } from '@/config/faucet_config';

export type FaucetSendErrorCode = 'not_configured' | 'dry' | 'send_failed';

// Thrown when no tokens left the faucet, so the route can give the claim slot back.
export class FaucetSendError extends Error {
  constructor(
    public readonly code: FaucetSendErrorCode,
    detail: string
  ) {
    super(detail);
    this.name = 'FaucetSendError';
  }
}

export function toSendError(error: unknown): FaucetSendError {
  if (error instanceof FaucetSendError) return error;
  const detail = error instanceof Error ? error.message : String(error);
  return new FaucetSendError(FAUCET_DRY_ERROR_PATTERN.test(detail) ? 'dry' : 'send_failed', detail);
}
