import 'server-only';
import { FAUCET_ENV } from '@/config/faucet_config';
import { readEnv } from './env';
import { FaucetSendError } from './errors';

// Per-address, per-token claim cooldown, stored in Upstash Redis via its REST
// API. `SET key NX EX` checks and reserves in one step, so two simultaneous
// clicks can't both pass.
//
// Without Redis env vars, local dev falls back to an in-memory store (resets
// on restart). Production refuses to run without Redis.

interface CooldownStore {
  // null = reserved; otherwise the seconds left on the existing cooldown.
  reserve(key: string, seconds: number): Promise<number | null>;
  release(key: string): Promise<void>;
  // Seconds left on the cooldown, or null if there is none.
  remaining(key: string): Promise<number | null>;
}

function upstashStore(url: string, token: string): CooldownStore {
  const command = async (args: (string | number)[]): Promise<unknown> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(args),
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
    if (!res.ok || json.error) throw new Error(`Redis ${args[0]} failed: ${json.error ?? res.status}`);
    return json.result;
  };

  return {
    async reserve(key, seconds) {
      const set = await command(['SET', key, Date.now(), 'NX', 'EX', seconds]);
      if (set === 'OK') return null;
      const ttl = Number(await command(['TTL', key]));
      return ttl > 0 ? ttl : seconds;
    },
    async release(key) {
      await command(['DEL', key]);
    },
    async remaining(key) {
      const ttl = Number(await command(['TTL', key]));
      return ttl > 0 ? ttl : null;
    },
  };
}

function memoryStore(): CooldownStore {
  // Kept on globalThis so dev hot reloads don't wipe it.
  const g = globalThis as { __faucetCooldowns?: Map<string, number> };
  const expiries = (g.__faucetCooldowns ??= new Map<string, number>());
  return {
    async reserve(key, seconds) {
      const now = Date.now();
      const expires = expiries.get(key);
      if (expires && expires > now) return Math.ceil((expires - now) / 1000);
      expiries.set(key, now + seconds * 1000);
      return null;
    },
    async release(key) {
      expiries.delete(key);
    },
    async remaining(key) {
      const left = (expiries.get(key) ?? 0) - Date.now();
      return left > 0 ? Math.ceil(left / 1000) : null;
    },
  };
}

let store: CooldownStore | null = null;

function getStore(): CooldownStore {
  if (store) return store;
  const url = readEnv(FAUCET_ENV.redisUrl);
  const token = readEnv(FAUCET_ENV.redisToken);
  if (url && token) {
    store = upstashStore(url, token);
  } else if (process.env.NODE_ENV !== 'production') {
    console.warn('[faucet] No Redis env vars; using an in-memory cooldown store (dev only).');
    store = memoryStore();
  } else {
    throw new FaucetSendError('not_configured', 'Redis env vars are missing');
  }
  return store;
}

export const reserveClaim = (key: string, seconds: number) => getStore().reserve(key, seconds);
export const releaseClaim = (key: string) => getStore().release(key);
export const claimCooldownLeft = (key: string) => getStore().remaining(key);
