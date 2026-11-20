import { NextResponse } from 'next/server';
import {
  FAUCET_COOLDOWN_SECONDS,
  FAUCET_ERRORS,
  FAUCET_REDIS_KEY_PREFIX,
  FAUCET_TOKENS,
} from '@/config/faucet_config';
import type { FaucetClaimFailure, FaucetClaimResponse } from '@/lib/faucet/types';
import { releaseClaim, reserveClaim } from '@/lib/faucet/server/cooldown';
import { toSendError } from '@/lib/faucet/server/errors';
import { parseEvmRecipient, sendEvm } from '@/lib/faucet/server/evm';
import { parseSolanaRecipient, sendSolana } from '@/lib/faucet/server/solana';

// Vercel function time limit (seconds). Must be a literal here; keep it above
// FAUCET_CONFIRM_TIMEOUT_MS in config/faucet_config.ts.
export const maxDuration = 60;

const fail = (status: number, body: Omit<FaucetClaimFailure, 'ok'>, headers?: HeadersInit) =>
  NextResponse.json<FaucetClaimResponse>({ ok: false, ...body }, { status, headers });

// POST { tokenId, recipient } → sends that token's configured amount from the
// faucet wallet, at most once per token per address per FAUCET_COOLDOWN_SECONDS.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const tokenId = body?.tokenId;
  const rawRecipient = body?.recipient;
  if (typeof tokenId !== 'string' || typeof rawRecipient !== 'string') {
    return fail(400, { code: 'bad_request', message: FAUCET_ERRORS.badRequest });
  }

  // The amount always comes from config, never from the request.
  const token = FAUCET_TOKENS.find((t) => t.id === tokenId);
  if (!token) return fail(400, { code: 'invalid_token', message: FAUCET_ERRORS.invalidToken });

  const evmRecipient = token.vm === 'evm' ? parseEvmRecipient(rawRecipient.trim()) : null;
  const solanaRecipient = token.vm === 'svm' ? parseSolanaRecipient(rawRecipient.trim()) : null;
  if (!evmRecipient && !solanaRecipient) {
    return fail(400, { code: 'invalid_address', message: FAUCET_ERRORS.invalidAddress(token.network) });
  }

  // EVM addresses are case-insensitive, so the key uses lowercase; Solana's are not.
  const addressKey = evmRecipient ? evmRecipient.toLowerCase() : solanaRecipient!.toBase58();
  const key = `${FAUCET_REDIS_KEY_PREFIX}:${token.id}:${addressKey}`;

  let waitSeconds: number | null;
  try {
    waitSeconds = await reserveClaim(key, FAUCET_COOLDOWN_SECONDS);
  } catch (error) {
    console.error('[faucet] cooldown store unavailable', error);
    return fail(503, { code: 'not_configured', message: FAUCET_ERRORS.notConfigured });
  }
  if (waitSeconds !== null) {
    return fail(
      429,
      { code: 'cooldown', message: FAUCET_ERRORS.cooldown, retryAfterSeconds: waitSeconds },
      { 'Retry-After': String(waitSeconds) }
    );
  }

  try {
    const sent = evmRecipient ? await sendEvm(token, evmRecipient) : await sendSolana(token, solanaRecipient!);
    console.info('[faucet] sent', token.id, addressKey, sent.txHash);
    return NextResponse.json<FaucetClaimResponse>({
      ok: true,
      amount: token.amount,
      symbol: token.symbol,
      ...sent,
    });
  } catch (error) {
    // Nothing left the faucet, so give the claim slot back.
    const sendError = toSendError(error);
    console.error('[faucet] claim failed', token.id, addressKey, sendError.code, sendError.message);
    await releaseClaim(key).catch((releaseError) =>
      console.error('[faucet] could not release cooldown', key, releaseError)
    );
    const message =
      sendError.code === 'dry'
        ? FAUCET_ERRORS.dry
        : sendError.code === 'not_configured'
          ? FAUCET_ERRORS.notConfigured
          : FAUCET_ERRORS.sendFailed;
    return fail(sendError.code === 'send_failed' ? 502 : 503, { code: sendError.code, message });
  }
}
