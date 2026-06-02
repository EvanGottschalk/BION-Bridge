import {
  RELAY_STATUS_POLL_INTERVAL_MS,
  RELAY_STATUS_POLL_TIMEOUT_MS,
  RELAY_TERMINAL_STATUSES,
} from '@/config/relay_config';
import { relayApi } from './client';
import type { RelayStatus, RelayStatusResponse } from './types';

export const isTerminalStatus = (s: RelayStatus): boolean =>
  (RELAY_TERMINAL_STATUSES as readonly string[]).includes(s) || s === 'refund';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type PollStatusOptions = {
  onUpdate?: (status: RelayStatusResponse) => void;
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export const pollStatus = async (
  requestId: string,
  opts: PollStatusOptions = {}
): Promise<RelayStatusResponse> => {
  const interval = opts.intervalMs ?? RELAY_STATUS_POLL_INTERVAL_MS;
  const timeout = opts.timeoutMs ?? RELAY_STATUS_POLL_TIMEOUT_MS;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const res = await relayApi.getStatus(requestId, opts.signal);
      opts.onUpdate?.(res);
      if (isTerminalStatus(res.status)) return res;
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      // Transient errors: keep polling within the timeout.
    }
    await sleep(interval);
  }
  throw new Error(`Status poll timed out after ${timeout}ms for requestId=${requestId}`);
};
