'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TokenIcon } from '@/components/bridge/token-icon';
import { FaucetScene, type FaucetPhase } from './faucet-scene';
import { DorothyDialogue } from './dorothy-dialogue';
import { FaucetClaimError, formatWait, requestFaucetClaim } from '@/lib/faucet/claim';
import { fetchFaucetBalance, formatFaucetBalance } from '@/lib/faucet/balance';
import { formatUnits, parseUnits } from 'viem';
import { withOpacity } from '@/lib/faucet/color';
import {
  DOROTHY_LINES,
  FAUCET_COLORS,
  FAUCET_CONTROLS_BLUR_PX,
  FAUCET_CONTROLS_COLORS,
  FAUCET_CONTROLS_OPACITY,
  FAUCET_COPY,
  FAUCET_DEFAULT_TOKEN_ID,
  FAUCET_ICON_SIZE_PX,
  FAUCET_TIMING_MS,
  FAUCET_TOKENS,
  type FaucetToken,
} from '@/config/faucet_config';
import { SWAP_PROGRESS_COPY } from '@/config/ui_config';

const TRIGGER_CLASS = 'w-full !h-14 rounded-xl glass-inner px-3 text-base';

const blur = (px: number) => (px > 0 ? `blur(${px}px)` : 'none');

// Per-element transparency for the token-select box, from FAUCET_CONTROLS_*.
// Inline styles override the glass-* class backgrounds and blurs.
const CONTROLS_STYLE = {
  panel: {
    borderColor: FAUCET_COLORS.panelBorder,
    background: withOpacity(FAUCET_CONTROLS_COLORS.panel, FAUCET_CONTROLS_OPACITY.panel),
    backdropFilter: blur(FAUCET_CONTROLS_BLUR_PX.panel),
    WebkitBackdropFilter: blur(FAUCET_CONTROLS_BLUR_PX.panel),
  },
  tokenSelect: {
    background: withOpacity(FAUCET_CONTROLS_COLORS.tokenSelect, FAUCET_CONTROLS_OPACITY.tokenSelect),
    backdropFilter: blur(FAUCET_CONTROLS_BLUR_PX.tokenSelect),
    WebkitBackdropFilter: blur(FAUCET_CONTROLS_BLUR_PX.tokenSelect),
  },
  tokenList: {
    borderColor: FAUCET_COLORS.panelBorder,
    background: withOpacity(FAUCET_CONTROLS_COLORS.tokenList, FAUCET_CONTROLS_OPACITY.tokenList),
    backdropFilter: blur(FAUCET_CONTROLS_BLUR_PX.tokenList),
    WebkitBackdropFilter: blur(FAUCET_CONTROLS_BLUR_PX.tokenList),
    '--faucet-highlight': withOpacity(
      FAUCET_CONTROLS_COLORS.tokenListHighlight,
      FAUCET_CONTROLS_OPACITY.tokenListHighlight
    ),
  } as CSSProperties,
} satisfies Record<string, CSSProperties>;

// The disabled fade is applied to the fill and the label separately, never as
// `opacity` on the button itself: element opacity would also fade the blurred
// backdrop, letting the sharp forest show through and hiding the blur.
function claimButtonStyle(disabled: boolean): CSSProperties {
  const fade = disabled ? FAUCET_CONTROLS_OPACITY.claimButtonDisabled : 1;
  const fill = FAUCET_CONTROLS_OPACITY.claimButton * fade;
  const backdrop = blur(
    disabled ? FAUCET_CONTROLS_BLUR_PX.claimButtonDisabled : FAUCET_CONTROLS_BLUR_PX.claimButton
  );
  return {
    background: `linear-gradient(135deg, ${withOpacity(
      FAUCET_CONTROLS_COLORS.claimButtonFrom,
      fill
    )}, ${withOpacity(FAUCET_CONTROLS_COLORS.claimButtonTo, fill)})`,
    color: FAUCET_COLORS.buttonText,
    boxShadow: disabled ? 'none' : `0 6px 28px ${FAUCET_COLORS.energySoft}`,
    backdropFilter: backdrop,
    WebkitBackdropFilter: backdrop,
  };
}

const sleep =(ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

// The wallet label's balance. Read on-chain once per token / wallet; after a
// claim, the claimed amount is added locally and counted up over
// FAUCET_TIMING_MS.balanceCountUp (no re-read, so it shows up immediately).
function useWalletBalance(token: FaucetToken, owner: string | null, reducedMotion: boolean) {
  const [shown, setShown] = useState<number | null>(null);
  const raw = useRef<bigint | null>(null);
  const readId = useRef(0); // bumped to ignore an out-of-date read
  const frame = useRef<number | null>(null);

  const stopCounting = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };

  useEffect(() => {
    const id = ++readId.current;
    stopCounting();
    raw.current = null;
    setShown(null);
    if (!owner) return;
    fetchFaucetBalance(token, owner).then(
      (value) => {
        if (id !== readId.current) return;
        raw.current = value;
        setShown(Number(formatUnits(value, token.decimals)));
      },
      (error: unknown) => console.warn('[faucet] balance read failed', token.id, error)
    );
  }, [token, owner]);

  useEffect(() => stopCounting, []);

  const addClaim = useCallback(
    (amount: string) => {
      const before = raw.current;
      if (before === null) return; // balance unknown, nothing to add to
      readId.current++;
      const after = before + parseUnits(amount, token.decimals);
      raw.current = after;
      const from = Number(formatUnits(before, token.decimals));
      const to = Number(formatUnits(after, token.decimals));
      stopCounting();
      if (reducedMotion) {
        setShown(to);
        return;
      }
      // Intermediate values use the final value's decimals so the label doesn't jitter.
      const step = 10 ** (formatFaucetBalance(to).split('.')[1]?.length ?? 0);
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / FAUCET_TIMING_MS.balanceCountUp);
        const eased = 1 - (1 - t) ** 3;
        setShown(t < 1 ? Math.round((from + (to - from) * eased) * step) / step : to);
        frame.current = t < 1 ? requestAnimationFrame(tick) : null;
      };
      frame.current = requestAnimationFrame(tick);
    },
    [token, reducedMotion]
  );

  return { balance: shown === null ? null : formatFaucetBalance(shown), addClaim };
}

function TokenOption({ token, iconSize }: { token: FaucetToken; iconSize: number }) {
  return (
    <span className="flex items-center gap-2.5 min-w-0">
      <TokenIcon symbol={token.iconSymbol} size={iconSize} />
      <span className="flex flex-col items-start min-w-0 leading-tight">
        <span className="font-semibold text-foreground">{token.symbol}</span>
        <span className="text-[11px] text-muted-foreground truncate">
          {FAUCET_COPY.networkBadge(token.network)}
        </span>
      </span>
    </span>
  );
}

export function FaucetCard() {
  const reducedMotion = usePrefersReducedMotion();
  const evm = useAccount();
  const { openConnectModal } = useConnectModal();
  const solana = useWallet();
  const solanaModal = useWalletModal();

  const [tokenId, setTokenId] = useState<string>(FAUCET_DEFAULT_TOKEN_ID);
  const [phase, setPhase] = useState<FaucetPhase>('idle');
  const [line, setLine] = useState<string>(DOROTHY_LINES.greeting);
  const [busy, setBusy] = useState(false);
  const [txUrl, setTxUrl] = useState<string | null>(null); // explorer link for the last successful claim
  const mounted = useRef(true);
  // Radix Select's generated ids drift between server and client under the
  // wallet providers, so it only renders after hydration.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    mounted.current = true;
    setHydrated(true);
    return () => {
      mounted.current = false;
    };
  }, []);

  const token = FAUCET_TOKENS.find((t) => t.id === tokenId) ?? FAUCET_TOKENS[0];
  const recipient = token.vm === 'svm' ? solana.publicKey?.toBase58() ?? null : evm.address ?? null;
  const { balance: walletBalance, addClaim } = useWalletBalance(token, recipient, reducedMotion);

  const onTokenChange = (id: string) => {
    const next = FAUCET_TOKENS.find((t) => t.id === id);
    if (!next) return;
    setTokenId(id);
    setPhase('idle');
    setTxUrl(null);
    setLine(DOROTHY_LINES.tokenChosen(next.symbol, next.network));
  };

  const connect = useCallback(() => {
    setLine(DOROTHY_LINES.needsWallet(token.vm));
    if (token.vm === 'svm') solanaModal.setVisible(true);
    else openConnectModal?.();
  }, [token, solanaModal, openConnectModal]);

  const claim = useCallback(async () => {
    if (!recipient || busy) return;
    const wait = (ms: number) => sleep(reducedMotion ? 0 : ms);
    const step = (p: FaucetPhase, l?: string) => {
      if (!mounted.current) return false;
      setPhase(p);
      if (l) setLine(l);
      return true;
    };

    setBusy(true);
    setTxUrl(null);
    const claimPromise = requestFaucetClaim(token, recipient).then(
      (result) => ({ ok: true as const, result }),
      (error: unknown) => ({ ok: false as const, error })
    );

    try {
      if (!step('turning', DOROTHY_LINES.turning)) return;
      await wait(FAUCET_TIMING_MS.turning);
      if (!step('charging')) return;
      const [outcome] = await Promise.all([claimPromise, wait(FAUCET_TIMING_MS.charging)]);
      if (!outcome.ok) {
        const { error } = outcome;
        if (error instanceof FaucetClaimError && error.code === 'cooldown') {
          step('idle', DOROTHY_LINES.cooldown(token.symbol, formatWait(error.retryAfterSeconds ?? 0)));
        } else {
          const reason = error instanceof Error ? error.message : SWAP_PROGRESS_COPY.unknownError;
          step('idle', DOROTHY_LINES.failure(reason));
        }
        return;
      }
      setTxUrl(outcome.result.explorerUrl);
      if (!step('falling', DOROTHY_LINES.dropping)) return;
      await wait(FAUCET_TIMING_MS.falling);
      if (!step('splash', DOROTHY_LINES.success(outcome.result.amount, outcome.result.symbol))) return;
      addClaim(outcome.result.amount); // the drop landed: count the balance up
      await wait(FAUCET_TIMING_MS.splash);
      step('done');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [token, recipient, busy, reducedMotion, addClaim]);

  const button = !recipient
    ? { label: FAUCET_COPY.connectWallet(token.vm), onClick: connect, disabled: false }
    : { label: busy ? FAUCET_COPY.claiming : FAUCET_COPY.claim, onClick: claim, disabled: busy };

  return (
    <div className="w-full max-w-2xl lg:max-w-5xl grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 lg:gap-6">
      <div
        className="relative rounded-3xl glass-card overflow-hidden px-2 pt-2 sm:px-6 sm:pt-4 flex items-center justify-center"
        style={{ borderColor: FAUCET_COLORS.panelBorder, background: FAUCET_COLORS.scenePanel }}
      >
        <FaucetScene
          phase={phase}
          symbol={token.symbol}
          amount={token.amount}
          balance={walletBalance}
        />
      </div>

      <div className="flex flex-col gap-4 lg:justify-center">
        <DorothyDialogue line={line} reducedMotion={reducedMotion} />

        <div
          className="rounded-2xl glass-card p-3 sm:p-4 flex flex-col md:flex-row lg:flex-col md:items-end lg:items-stretch gap-3"
          style={CONTROLS_STYLE.panel}
        >
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <label htmlFor="faucet-token" className="text-xs uppercase tracking-wider text-muted-foreground">
              {FAUCET_COPY.tokenLabel}
            </label>
            {!hydrated ? (
              <div
                className={`${TRIGGER_CLASS} flex items-center border`}
                style={CONTROLS_STYLE.tokenSelect}
              >
                <TokenOption token={token} iconSize={FAUCET_ICON_SIZE_PX.selectTrigger} />
              </div>
            ) : (
              <Select value={tokenId} onValueChange={onTokenChange} disabled={busy}>
                <SelectTrigger
                  id="faucet-token"
                  className={`${TRIGGER_CLASS} cursor-pointer`}
                  style={CONTROLS_STYLE.tokenSelect}
                >
                  <SelectValue>
                    <TokenOption token={token} iconSize={FAUCET_ICON_SIZE_PX.selectTrigger} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  className="rounded-xl border"
                  style={CONTROLS_STYLE.tokenList}
                >
                  {FAUCET_TOKENS.map((t) => (
                    <SelectItem
                      key={t.id}
                      value={t.id}
                      className="py-2 cursor-pointer focus:bg-[var(--faucet-highlight)] focus:text-foreground"
                    >
                      <span className="flex w-full items-center justify-between gap-4">
                        <TokenOption token={t} iconSize={FAUCET_ICON_SIZE_PX.selectList} />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {FAUCET_COPY.perClaim(t.amount, t.symbol)}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <button
            type="button"
            onClick={button.onClick}
            disabled={button.disabled}
            className="faucet-claim-button h-14 md:w-56 lg:w-full shrink-0 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed cursor-pointer"
            style={claimButtonStyle(button.disabled)}
          >
            <span
              className="flex items-center justify-center gap-2"
              style={{ opacity: button.disabled ? FAUCET_CONTROLS_OPACITY.claimButtonDisabled : 1 }}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {button.label}
            </span>
          </button>
        </div>

        {txUrl && (
          <a
            href={txUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="self-center text-sm underline underline-offset-4 hover:opacity-80"
            style={{ color: FAUCET_COLORS.energy }}
          >
            {FAUCET_COPY.viewTransaction}
          </a>
        )}
      </div>
    </div>
  );
}
