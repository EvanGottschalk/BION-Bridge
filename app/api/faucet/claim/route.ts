import { NextResponse } from 'next/server';
import type { Address } from 'viem';
import type { PublicKey } from '@solana/web3.js';
import {
  FAUCET_COOLDOWN_SECONDS,
  FAUCET_ERRORS,
  FAUCET_REDIS_KEY_PREFIX,
  FAUCET_TOKENS,
  type FaucetToken,
} from '@/config/faucet_config';
import type { FaucetClaimFailure, FaucetClaimResponse, FaucetStatusResponse } from '@/lib/faucet/types';
import { claimCooldownLeft, releaseClaim, reserveClaim } from '@/lib/faucet/server/cooldown';
import { toSendError } from '@/lib/faucet/server/errors';
import { parseEvmRecipient, sendEvm } from '@/lib/faucet/server/evm';
import { parseSolanaRecipient, sendSolana } from '@/lib/faucet/server/solana';

// Vercel function time limit (seconds). Must be a literal here; keep it above
// FAUCET_CONFIRM_TIMEOUT_MS in config/faucet_config.ts.
export const maxDuration = 60;

const fail = (status: number, body: Omit<FaucetClaimFailure, 'ok'>, headers?: HeadersInit) =>
  NextResponse.json<FaucetClaimFailure>({ ok: false, ...body }, { status, headers });

interface ResolvedClaim {
  token: FaucetToken;
  evm: Address | null;
  solana: PublicKey | null;
  addressKey: string;
  key: string; // cooldown key in the store
}

// Validates the token id and recipient; returns an error response if either is bad.
function resolveClaim(tokenId: unknown, rawRecipient: unknown): ResolvedClaim | NextResponse {
  if (typeof tokenId !== 'string' || typeof rawRecipient !== 'string') {
    return fail(400, { code: 'bad_request', message: FAUCET_ERRORS.badRequest });
  }
  // The amount always comes from config, never from the request.
  const token = FAUCET_TOKENS.find((t) => t.id === tokenId);
  if (!token) return fail(400, { code: 'invalid_token', message: FAUCET_ERRORS.invalidToken });

  const evm = token.vm === 'evm' ? parseEvmRecipient(rawRecipient.trim()) : null;
  const solana = token.vm === 'svm' ? parseSolanaRecipient(rawRecipient.trim()) : null;
  if (!evm && !solana) {
    return fail(400, { code: 'invalid_address', message: FAUCET_ERRORS.invalidAddress(token.network) });
  }
  // EVM addresses are case-insensitive, so the key uses lowercase; Solana's are not.
  const addressKey = evm ? evm.toLowerCase() : solana!.toBase58();
  return { token, evm, solana, addressKey, key: `${FAUCET_REDIS_KEY_PREFIX}:${token.id}:${addressKey}` };
}

// GET ?tokenId=…&recipient=… → how long until this address can claim this token again.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const claim = resolveClaim(params.get('tokenId'), params.get('recipient'));
  if (claim instanceof NextResponse) return claim;
  try {
    const cooldownSeconds = await claimCooldownLeft(claim.key);
    return NextResponse.json<FaucetStatusResponse>(
      { ok: true, cooldownSeconds },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[faucet] cooldown store unavailable', error);
    return fail(503, { code: 'not_configured', message: FAUCET_ERRORS.notConfigured });
  }
}

// POST { tokenId, recipient } → sends that token's configured amount from the
// faucet wallet, at most once per token per address per FAUCET_COOLDOWN_SECONDS.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const claim = resolveClaim(body?.tokenId, body?.recipient);
  if (claim instanceof NextResponse) return claim;
  const { token, evm, solana, addressKey, key } = claim;

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
    const sent = evm ? await sendEvm(token, evm) : await sendSolana(token, solana!);
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
