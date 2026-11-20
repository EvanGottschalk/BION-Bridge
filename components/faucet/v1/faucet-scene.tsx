'use client';

import type { CSSProperties } from 'react';
import {
  FAUCET_COLORS,
  FAUCET_COPY,
  FAUCET_TIMING_MS,
  FAUCET_WALLET_FILL,
  FAUCET_WALLET_TITLE,
} from '@/config/faucet_config';

export type FaucetPhase = 'idle' | 'turning' | 'charging' | 'falling' | 'splash' | 'done';

interface FaucetSceneProps {
  phase: FaucetPhase;
  symbol: string;
  amount: string; // claimed per pour, for the "+amount" readout
  balance: string | null; // formatted wallet balance, null if unknown
  filled: boolean; // wallet shown full of energy (this token is on cooldown)
}

// Energy runs down the supply pipe, along the body, around the spout bend and
// out of the nozzle at (290, 142). The wallet's slot sits directly below it.
const CHANNEL_PATH = 'M 108 -4 L 108 93 L 262 93 Q 290 93 290 121 L 290 140';
const SPOUT_PATH = 'M 214 93 L 262 93 Q 290 93 290 121 L 290 130';
const NOZZLE = { x: 290, y: 142 };
const WALLET_SLOT_Y = 252;
const DROP_HEIGHT = 43;
const WHEEL = { x: 165, y: 40, r: 24 };
// Balance label on the wallet: centered between the wallet's left edge and the
// clasp. Long labels shrink (down from maxFontSize) to fit maxWidth.
const WALLET_LABEL = { x: 280, y: 289, maxWidth: 72, maxFontSize: 14, charWidthEm: 0.62 };
// "MY WALLET" title: centered in the strip between the wallet's top edge (252)
// and its dotted line (268).
const WALLET_TITLE_POS = { x: 290, y: 260.5 };
const WALLET_BODY = { x: 232, y: 252, width: 116, height: 60, rx: 12 };
const WALLET_DOTTED_LINE_Y = 268;
// A full wallet's energy stops halfway between the dotted line and the bottom
// of the "MY WALLET" title, so it follows FAUCET_WALLET_TITLE.fontSize.
const WALLET_FILL_TOP =
  (WALLET_DOTTED_LINE_Y + WALLET_TITLE_POS.y + FAUCET_WALLET_TITLE.fontSize / 2) / 2;

const SPLASH_PARTICLES = [
  { dx: -46, dy: -34 },
  { dx: -28, dy: -52 },
  { dx: -8, dy: -60 },
  { dx: 12, dy: -56 },
  { dx: 30, dy: -48 },
  { dx: 48, dy: -30 },
  { dx: -36, dy: -18 },
  { dx: 38, dy: -14 },
];

export function FaucetScene({ phase, symbol, amount, balance, filled }: FaucetSceneProps) {
  const c = FAUCET_COLORS;
  const label = FAUCET_COPY.walletBalance(balance, symbol);
  const labelSize = Math.min(
    WALLET_LABEL.maxFontSize,
    WALLET_LABEL.maxWidth / (label.length * WALLET_LABEL.charWidthEm)
  );
  const timing = {
    '--faucet-turning': `${FAUCET_TIMING_MS.turning}ms`,
    '--faucet-charging': `${FAUCET_TIMING_MS.charging}ms`,
    '--faucet-falling': `${FAUCET_TIMING_MS.falling}ms`,
    '--faucet-splash': `${FAUCET_TIMING_MS.splash}ms`,
    '--faucet-fall-distance': `${WALLET_SLOT_Y - NOZZLE.y - DROP_HEIGHT + 8}px`,
    '--faucet-wallet-fill-opacity': FAUCET_WALLET_FILL.opacity,
  } as CSSProperties;

  return (
    <svg
      viewBox="36 0 360 320"
      className="faucet-scene block w-full h-auto max-h-[52vh] lg:max-h-[68vh]"
      data-phase={phase}
      data-filled={filled}
      style={timing}
      role="img"
      aria-label={FAUCET_COPY.sceneAria}
    >
      <defs>
        <linearGradient id="faucet-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.metalLight} />
          <stop offset="55%" stopColor={c.metalMid} />
          <stop offset="100%" stopColor={c.metalDark} />
        </linearGradient>
        <linearGradient id="faucet-metal-v" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={c.metalDark} />
          <stop offset="45%" stopColor={c.metalLight} />
          <stop offset="100%" stopColor={c.metalDark} />
        </linearGradient>
        <linearGradient id="faucet-energy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.energy} />
          <stop offset="100%" stopColor={c.energyDeep} />
        </linearGradient>
        <radialGradient id="faucet-drop-fill" cx="38%" cy="62%" r="70%">
          <stop offset="0%" stopColor={c.energyCore} />
          <stop offset="35%" stopColor={c.energy} />
          <stop offset="100%" stopColor={c.energyDeep} />
        </radialGradient>
        <radialGradient id="faucet-wallet-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={c.energyGlow} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <filter id="faucet-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="faucet-glow-strong" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Exactly the wallet body's shape, so the fill never pokes past its corners. */}
        <clipPath id="faucet-wallet-clip">
          <rect x={WALLET_BODY.x} y={WALLET_BODY.y} width={WALLET_BODY.width} height={WALLET_BODY.height} rx={WALLET_BODY.rx} />
        </clipPath>
      </defs>

      {/* Ground line + wallet halo */}
      <line x1={36} y1={313} x2={396} y2={313} stroke={c.circuit} strokeWidth={0.75} strokeDasharray="2 6" />
      <ellipse cx={290} cy={312} rx={80} ry={10} fill="url(#faucet-wallet-glow)" className="faucet-wallet-halo" />

      {/* Circuit sprouts on the ground, left side */}
      <g stroke={c.circuit} strokeWidth={1.2} fill="none" strokeLinejoin="round" filter="url(#faucet-glow)">
        <path d="M 70 313 L 70 280 L 82 268 L 82 252" />
        <path d="M 70 290 L 58 278 L 58 266" />
        <path d="M 130 313 L 130 292 L 142 280" />
        <path d="M 130 300 L 118 288" />
      </g>
      <g fill={c.node}>
        <circle cx={82} cy={252} r={2.5} className="faucet-node" />
        <circle cx={58} cy={266} r={2} className="faucet-node" style={{ animationDelay: '1.2s' }} />
        <circle cx={142} cy={280} r={2.5} className="faucet-node" style={{ animationDelay: '0.6s' }} />
        <circle cx={118} cy={288} r={2} className="faucet-node" style={{ animationDelay: '2s' }} />
      </g>

      {/* Supply pipe from above */}
      <rect x={96} y={-4} width={24} height={82} fill="url(#faucet-metal-v)" stroke={c.metalEdge} strokeWidth={0.75} />
      <rect x={92} y={16} width={32} height={8} rx={2} fill={c.metalMid} stroke={c.metalEdge} strokeWidth={0.75} />

      {/* Spout (drawn under the body so the joint is hidden) */}
      <path d={SPOUT_PATH} stroke={c.metalEdge} strokeWidth={30} fill="none" />
      <path d={SPOUT_PATH} stroke="url(#faucet-metal-v)" strokeWidth={28.5} fill="none" />

      {/* Body */}
      <rect x={80} y={70} width={150} height={46} rx={16} fill="url(#faucet-metal)" stroke={c.metalEdge} strokeWidth={0.75} />
      <g fill={c.metalDark}>
        {[136, 148, 192, 204].map((x) => (
          <rect key={x} x={x} y={104} width={6} height={5} rx={1} />
        ))}
      </g>
      <g fill={c.metalEdge}>
        {[90, 220].map((x) => (
          <circle key={x} cx={x} cy={80} r={1.6} />
        ))}
      </g>

      {/* Valve stem + wheel */}
      <rect x={158} y={50} width={14} height={22} fill="url(#faucet-metal-v)" stroke={c.metalEdge} strokeWidth={0.75} />
      <g className="faucet-wheel" style={{ transformOrigin: `${WHEEL.x}px ${WHEEL.y}px` }}>
        <circle cx={WHEEL.x} cy={WHEEL.y} r={WHEEL.r} fill="none" stroke={c.metalLight} strokeWidth={6} />
        <circle
          cx={WHEEL.x}
          cy={WHEEL.y}
          r={WHEEL.r}
          fill="none"
          stroke={c.energy}
          strokeWidth={1.5}
          className="faucet-wheel-ring"
          filter="url(#faucet-glow)"
        />
        {[0, 45, 90, 135].map((deg) => (
          <rect
            key={deg}
            x={WHEEL.x - 2}
            y={WHEEL.y - WHEEL.r}
            width={4}
            height={WHEEL.r * 2}
            rx={2}
            fill={c.metalLight}
            transform={`rotate(${deg} ${WHEEL.x} ${WHEEL.y})`}
          />
        ))}
        {[0, 90, 180, 270].map((deg) => (
          <circle
            key={deg}
            cx={WHEEL.x}
            cy={WHEEL.y - WHEEL.r}
            r={3}
            fill={c.energy}
            transform={`rotate(${deg} ${WHEEL.x} ${WHEEL.y})`}
            className="faucet-wheel-ring"
          />
        ))}
        <circle cx={WHEEL.x} cy={WHEEL.y} r={7} fill={c.metalMid} stroke={c.metalEdge} strokeWidth={1} />
        <circle cx={WHEEL.x} cy={WHEEL.y} r={2.5} fill={c.energy} />
      </g>

      {/* Energy channel through the whole faucet */}
      <path d={CHANNEL_PATH} stroke={c.seamIdle} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path
        d={CHANNEL_PATH}
        stroke="url(#faucet-energy)"
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
        strokeDasharray="8 10"
        className="faucet-channel"
        filter="url(#faucet-glow)"
      />

      {/* Nozzle */}
      <rect x={272} y={128} width={36} height={12} rx={3} fill="url(#faucet-metal)" stroke={c.metalEdge} strokeWidth={0.75} />
      <rect
        x={276}
        y={139}
        width={28}
        height={3}
        rx={1.5}
        fill={c.energy}
        className="faucet-nozzle-lip"
        filter="url(#faucet-glow)"
      />

      {/* Idle drip */}
      <g transform={`translate(${NOZZLE.x} ${NOZZLE.y})`}>
        <circle r={2.5} fill={c.energy} className="faucet-idle-drip" filter="url(#faucet-glow)" />
      </g>

      {/* The big drop */}
      <g transform={`translate(${NOZZLE.x} ${NOZZLE.y})`}>
        <g className="faucet-drop">
          <path
            d="M 0 0 C 5 9 15 16 15 28 A 15 15 0 1 1 -15 28 C -15 16 -5 9 0 0 Z"
            fill="url(#faucet-drop-fill)"
            filter="url(#faucet-glow-strong)"
          />
          <ellipse cx={-5.5} cy={24} rx={3.2} ry={6} fill={c.energyCore} opacity={0.8} />
          <path d="M -8 33 L -3 33 L -3 37 L 3 37" stroke={c.energyCore} strokeWidth={1.2} fill="none" opacity={0.6} />
        </g>
      </g>

      {/* Wallet */}
      <g className="faucet-wallet">
        <rect x={238} y={240} width={104} height={20} rx={6} fill={c.metalMid} stroke={c.walletEdge} strokeWidth={0.75} />
        <rect x={232} y={252} width={116} height={60} rx={12} fill={c.wallet} stroke={c.walletEdge} strokeWidth={1.25} />
        <g clipPath="url(#faucet-wallet-clip)">
          <rect
            x={WALLET_BODY.x}
            y={WALLET_FILL_TOP}
            width={WALLET_BODY.width}
            height={WALLET_BODY.y + WALLET_BODY.height - WALLET_FILL_TOP}
            fill="url(#faucet-energy)"
            className="faucet-wallet-fill"
          />
        </g>
        <rect
          x={232}
          y={252}
          width={116}
          height={60}
          rx={12}
          fill="none"
          stroke={c.energy}
          strokeWidth={2}
          className="faucet-wallet-flash"
          filter="url(#faucet-glow)"
        />
        <text
          x={WALLET_TITLE_POS.x}
          y={WALLET_TITLE_POS.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={FAUCET_WALLET_TITLE.color}
          fontSize={FAUCET_WALLET_TITLE.fontSize}
          fontWeight={FAUCET_WALLET_TITLE.fontWeight}
          letterSpacing={FAUCET_WALLET_TITLE.letterSpacing}
          fontFamily={FAUCET_WALLET_TITLE.fontFamily}
        >
          {FAUCET_WALLET_TITLE.text}
        </text>
        <path d={`M 244 ${WALLET_DOTTED_LINE_Y} L 336 ${WALLET_DOTTED_LINE_Y}`} stroke={c.circuit} strokeWidth={0.75} strokeDasharray="3 4" />
        <rect x={322} y={274} width={34} height={22} rx={7} fill={c.metalMid} stroke={c.walletEdge} strokeWidth={1} />
        <circle cx={337} cy={285} r={4} fill={c.energy} className="faucet-node" />
        <text
          x={WALLET_LABEL.x}
          y={WALLET_LABEL.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={c.walletText}
          fontSize={labelSize}
          fontWeight={600}
          letterSpacing={0.5}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {label}
        </text>
      </g>

      {/* Impact ripples + splash */}
      <g transform={`translate(${NOZZLE.x} ${WALLET_SLOT_Y})`}>
        {[0, 1, 2].map((i) => (
          <ellipse
            key={i}
            rx={14}
            ry={4}
            fill="none"
            stroke={c.energy}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            className="faucet-ripple"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
        {SPLASH_PARTICLES.map((p, i) => (
          <circle
            key={i}
            r={i % 2 === 0 ? 2.5 : 1.8}
            fill={i % 3 === 0 ? c.energyCore : c.energy}
            className="faucet-splash-particle"
            filter="url(#faucet-glow)"
            style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px` } as CSSProperties}
          />
        ))}
      </g>

      {/* +amount readout */}
      <text
        x={NOZZLE.x}
        y={WALLET_SLOT_Y - 36}
        textAnchor="middle"
        fill={c.energyCore}
        fontSize={16}
        fontWeight={700}
        className="faucet-amount"
        filter="url(#faucet-glow)"
      >
        {FAUCET_COPY.claimedAmount(amount, symbol)}
      </text>
    </svg>
  );
}
