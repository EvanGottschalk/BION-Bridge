// Faucet page literals: route, copy, tokens, Dorothy's lines, animation timing
// and the cyber-forest palette. See CLAUDE.md Non-Negotiable Rule #1.

import type { StaticImageData } from 'next/image';
import dorothyImage from '../src/image/Dorothy.png';
import * as baseSepoliaTokens from './token_info/base_testnet_sepolia_tokens';
import * as solanaDevnetTokens from './token_info/solana_devnet_tokens';
import { BASE_SEPOLIA, HELIUS_API_KEY_PLACEHOLDER, SOLANA_DEVNET } from './chain_info';

export const FAUCET_V1_ROUTE = '/faucet/v1';

// ── Real claims ─────────────────────────────────────────────────────────────
// The page POSTs { tokenId, recipient } here; app/api/faucet/claim/route.ts
// sends the tokens from the faucet wallets. See docs/dev_notes/Faucet.md.
export const FAUCET_API_ROUTE = '/api/faucet/claim';

// One claim per token, per address, per this many seconds.
export const FAUCET_COOLDOWN_SECONDS = 24 * 60 * 60;

// Redis keys look like `${prefix}:${tokenId}:${address}`. Changing the prefix
// resets everyone's cooldown.
export const FAUCET_REDIS_KEY_PREFIX = 'faucet:v1';

// Names of the server-only environment variables (never NEXT_PUBLIC_).
// Redis: the Vercel Upstash integration sets KV_REST_API_*; a direct Upstash
// setup uses UPSTASH_REDIS_REST_*. Either pair works.
export const FAUCET_ENV = {
  evmPrivateKey: 'FAUCET_EVM_PRIVATE_KEY', // 0x-prefixed hex
  solanaSecretKey: 'FAUCET_SOLANA_SECRET_KEY', // base58 (Phantom export) or a JSON byte array
  redisUrl: ['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL'],
  redisToken: ['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN'],
} as const;

// Chains the faucet wallets send on. RPC URLs go through resolveRpcUrls, so
// entries needing a missing API key are skipped.
export const FAUCET_EVM_CHAIN = BASE_SEPOLIA;
export const FAUCET_SOLANA_CHAIN = SOLANA_DEVNET;
export const FAUCET_SOLANA_RPC_URLS = [
  `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY_PLACEHOLDER}`,
  ...SOLANA_DEVNET.rpcUrls,
];

export const faucetExplorerTxUrl = (
  chain: { explorerUrl: string; explorerQuery?: string },
  txHash: string
) => `${chain.explorerUrl}/tx/${txHash}${chain.explorerQuery ?? ''}`;

// How long the server waits for a sent transaction to confirm before
// replying anyway (the tx usually still lands). Keep well under the route's
// `maxDuration` (60 s in app/api/faucet/claim/route.ts; Next.js requires that
// one to be written as a literal in the route file).
export const FAUCET_CONFIRM_TIMEOUT_MS = 30_000;

// A failed send whose error matches this is reported as "the faucet is dry"
// (EVM: insufficient funds; Solana: no SOL / no token balance).
export const FAUCET_DRY_ERROR_PATTERN =
  /insufficient (funds|lamports)|no record of a prior credit|custom program error: 0x1\b/i;

// Messages the claim route returns; Dorothy reads them out via DOROTHY_LINES.failure.
export const FAUCET_ERRORS = {
  badRequest: 'That request didn’t look right.',
  cooldown: 'Already claimed recently.',
  invalidToken: 'I don’t pour that token here.',
  invalidAddress: (network: string) => `That isn’t a valid ${network} address.`,
  notConfigured: 'The faucet isn’t hooked up yet.',
  dry: 'The faucet is running dry. Please tell the team!',
  sendFailed: 'The transaction didn’t go through.',
  network: 'I couldn’t reach the faucet.',
} as const;

export const FAUCET_PAGE_META = {
  title: 'Faucet',
  description: 'Claim free testnet tokens from the Aphid cyber faucet, guided by Dorothy.',
} as const;

export const FAUCET_COPY = {
  heading: 'Test Token Faucet',
  subheading: 'Free testnet tokens, poured fresh from the cyber forest.',
  tokenLabel: 'Token',
  claim: 'Claim Tokens',
  claiming: 'Claiming…',
  connectWallet: (vm: 'evm' | 'svm') =>
    vm === 'svm' ? 'Connect Solana wallet' : 'Connect EVM wallet',
  perClaim: (amount: string, symbol: string) => `${amount} ${symbol} per claim`,
  networkBadge: (network: string) => network,
  // Label on the wallet, e.g. "0.023 ETH". `balance` is null while it's
  // loading, if no wallet is connected, or if it couldn't be read.
  walletBalance: (balance: string | null, symbol: string) => `${balance ?? '—'} ${symbol}`,
  sceneAria:'A cyber faucet pouring liquid digital energy into your wallet',
  skipHint: 'Tap to skip',
  claimedAmount: (amount: string, symbol: string) => `+${amount} ${symbol}`,
  viewTransaction: 'View transaction ↗',
  // Time left on a cooldown, e.g. "5h 12m" or "3m".
  duration: (hours: number, minutes: number) => (hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`),
} as const;

// Dorothy appears as an NPC portrait beside her dialogue box.
export const DOROTHY = {
  name: 'Dorothy',
  title: 'Aphid Assistant',
  image: dorothyImage as StaticImageData,
  // CSS object-position for the portrait crop (her face + headphones).
  portraitFocus: '52% 30%',
  portraitZoom: 1.55,
} as const;

// Dorothy speaks on every step of the claim flow.
export const DOROTHY_LINES = {
  greeting:
    "Welcome, traveler! I'm glad you made it. We are in the Test Token Faucet, which you can use to get test cryptocurrency tokens. Use the select list to claim your tokens!",
  tokenChosen: (symbol: string, network: string) =>
    `Ah, ${symbol} on ${network}. Good choice! Press “Claim Tokens” whenever you’re ready.`,
  needsWallet: (vm: 'evm' | 'svm') =>
    vm === 'svm'
      ? 'I need somewhere to pour it! Connect a Solana wallet up top first.'
      : 'I need somewhere to pour it! Connect an EVM wallet up top first.',
  turning: 'Turning the valve… hold your antennae!',
  dropping: 'Here it comes!',
  success: (amount: string, symbol: string) =>
    `Splash! ${amount} ${symbol} landed safely in your wallet. Come back any time.`,
  failure: (reason: string) => `Oh no, the pipes sputtered: ${reason} Want to try again?`,
  cooldown: (symbol: string, wait: string) =>
    `You already got your ${symbol} today! The faucet refills for you in ${wait}.`,
} as const;

export type FaucetVm = 'evm' | 'svm';

export interface FaucetToken {
  id: string; // unique per token + network
  symbol: string;
  name: string;
  iconSymbol: string; // file name under src/image/tokens
  network: string;
  vm: FaucetVm;
  address: string; // token contract / mint, or FAUCET_NATIVE for ETH / SOL
  decimals: number;
  amount: string; // human-readable amount poured per claim
}

// `address` value for the chain's own coin (ETH on Base Sepolia, SOL on Solana).
export const FAUCET_NATIVE = 'native';

export const FAUCET_TOKENS: readonly FaucetToken[] = [
  // {
  //   id: 'tbion-base-sepolia',
  //   symbol: baseSepoliaTokens.TBION.symbol,
  //   name: baseSepoliaTokens.TBION.name,
  //   iconSymbol: 'tBION',
  //   network: 'Base Sepolia',
  //   vm: 'evm',
  //   address: baseSepoliaTokens.TBION.address,
  //   decimals: baseSepoliaTokens.TBION.decimals,
  //   amount: '100',
  // },
  {
    id: 'tbion-solana-devnet',
    symbol: solanaDevnetTokens.TBION.symbol,
    name: solanaDevnetTokens.TBION.name,
    iconSymbol: 'tBION',
    network: 'Solana Devnet',
    vm: 'svm',
    address: solanaDevnetTokens.TBION.address,
    decimals: solanaDevnetTokens.TBION.decimals,
    amount: '9999',
  },
  // {
  //   id: 'brdgtst-base-sepolia',
  //   symbol: baseSepoliaTokens.BRDGTST.symbol,
  //   name: baseSepoliaTokens.BRDGTST.name,
  //   iconSymbol: 'BRDGTST',
  //   network: 'Base Sepolia',
  //   vm: 'evm',
  //   address: baseSepoliaTokens.BRDGTST.address,
  //   decimals: baseSepoliaTokens.BRDGTST.decimals,
  //   amount: '50',
  // },
  // {
  //   id: 'brdgtst-solana-devnet',
  //   symbol: solanaDevnetTokens.BRDGTST.symbol,
  //   name: solanaDevnetTokens.BRDGTST.name,
  //   iconSymbol: 'BRDGTST',
  //   network: 'Solana Devnet',
  //   vm: 'svm',
  //   address: solanaDevnetTokens.BRDGTST.address,
  //   decimals: solanaDevnetTokens.BRDGTST.decimals,
  //   amount: '50',
  // },
  {
    id: 'sol-devnet',
    symbol: 'Test SOL',
    name: 'Devnet SOL',
    iconSymbol: 'SOL Test',
    network: 'Solana Devnet',
    vm: 'svm',
    address: FAUCET_NATIVE,
    decimals: 9,
    amount: '.1',
  },
  {
    id: 'eth-base-sepolia',
    symbol: 'Test ETH',
    name: 'Base Sepolia Ether',
    iconSymbol: 'ETH Test',
    network: 'Base Sepolia',
    vm: 'evm',
    address: FAUCET_NATIVE,
    decimals: 18,
    amount: '0.001',
  },
] as const;

// Animation phases, in milliseconds. Order: turning → charging → falling →
// splash. The reduced-motion variants skip straight to the result.
export const FAUCET_TIMING_MS = {
  turning: 1100, // valve wheel spins, energy runs through the pipe
  charging: 900, // drop swells at the spout
  falling: 650, // drop falls into the wallet
  splash: 1500, // wallet ripples and glows, +amount floats up
  balanceCountUp: 900, // the wallet's balance counts up to its new value (starts with splash)
} as const;

// The wallet fills with energy when a claim lands and stays filled until that
// token's cooldown (FAUCET_COOLDOWN_SECONDS) runs out for the connected wallet.
// opacity: how strong the filled energy looks (1 = solid; lower keeps the
// wallet's text readable).
export const FAUCET_WALLET_FILL = {
  opacity: 0.5,
} as const;

// How the top of the energy looks in a filled wallet:
//   'waves'   – the surface rolls in two layers of moving waves
//   'ripples' – a flat surface with small rings spreading across it
//   'flat'    – a still, flat surface
// Sizes are in the scene's SVG units. The surface sits between the "MY WALLET"
// title and the dotted line, ~4 units apart, so a wave amplitude above ~2
// starts to touch the title.
export type FaucetWalletSurfaceStyle = 'waves' | 'ripples' | 'flat';
export const FAUCET_WALLET_SURFACE = {
  style: 'waves' as FaucetWalletSurfaceStyle,
  waves: {
    amplitude: 1.6, // height of a crest above the mean surface
    wavelength: 26, // crest-to-crest distance (the wallet is 116 wide)
    durationMs: 2400, // time for the front wave to travel one wavelength
    backWaveOpacity: 0.55, // second wave behind it, moving the other way (0 = none)
  },
  ripples: {
    count: 3, // rings spread evenly across the surface, taking turns
    width: 28, // ring width at its largest
    durationMs: 2600, // one ring's grow-and-fade
    color: '#E8FFF9',
    strokeWidth: 0.8,
  },
};

// Title printed on the wallet, above its dotted line. Sizes are in the
// scene's SVG units (the wallet is 116 wide; the strip above the dotted line
// is about 16 tall, so keep fontSize under ~10).
export const FAUCET_WALLET_TITLE = {
  text: 'MY WALLET',
  fontSize: 6,
  fontWeight: 400,
  letterSpacing: 1.5,
  color: 'rgba(207,250,240,0.4)',
  fontFamily: 'inherit', // any CSS font-family, e.g. 'monospace'
} as const;

// Selected when the page loads, so a token is always chosen.
export const FAUCET_DEFAULT_TOKEN_ID = 'tbion-solana-devnet';

// How balances are written on the wallet: "19,998" / "0.0231".
export const FAUCET_BALANCE_FORMAT = {
  locale: 'en-US',
  maxFractionDigits: 4,
} as const;

export const FAUCET_TYPEWRITER_MS_PER_CHAR = 22;

export const FAUCET_ICON_SIZE_PX = {
  selectList: 40,
  selectTrigger: 40,
} as const;

// Liquid digital energy + cyber-forest palette.
export const FAUCET_COLORS = {
  energy: '#2EF2C4', // blue-green core of the liquid energy
  energyDeep: '#14A8E8', // blue edge of the liquid energy
  energyCore: '#E8FFF9', // hot white highlight inside a drop
  energyGlow: 'rgba(46,242,196,0.55)',
  energySoft: 'rgba(46,242,196,0.15)',
  metalLight: '#3A4B5C',
  metalMid: '#1E2A36',
  metalDark: '#0C131B',
  metalEdge: 'rgba(160,220,255,0.35)',
  seamIdle: 'rgba(46,242,196,0.25)',
  wallet: '#101A24',
  walletEdge: 'rgba(46,242,196,0.45)',
  walletText: '#CFFAF0',
  skyTop: '#020A0B',
  skyBottom: '#04181A',
  treeFar: '#06201F',
  treeNear: '#0A2E2A',
  circuit: 'rgba(46,242,196,0.35)',
  circuitDim: 'rgba(20,168,232,0.18)',
  node: '#2EF2C4',
  mote: 'rgba(160,255,230,0.9)',
  ground: 'rgba(46,242,196,0.08)',
  panelBorder: 'rgba(46,242,196,0.25)',
  scenePanel: 'rgba(2,14,14,0.78)', // backdrop behind the faucet so the forest doesn't compete
  buttonText: '#03201B',
} as const;

// Transparency of each element in the token-select box (the box holding
// TOKEN, "Choose a token" and "Claim Tokens"). 0 = fully see-through,
// 1 = fully solid. Each value applies to the matching color in
// FAUCET_CONTROLS_COLORS below, so you can change opacity and color separately.
export const FAUCET_CONTROLS_OPACITY = {
  panel: 0.78, // the outer box behind everything
  tokenSelect: 0.6, // the "Choose a token" rectangle
  tokenList: 0.92, // the dropdown list that opens from "Choose a token"
  tokenListHighlight: 0.15, // the hovered / focused row inside that list
  claimButton: 0.9, // the "Claim Tokens" rectangle's fill
  claimButtonDisabled: 0.45, // the whole "Claim Tokens" button (text included) while it can't be pressed
} as const;

// Solid base colors (hex) that the opacities above are applied to.
export const FAUCET_CONTROLS_COLORS = {
  panel: '#020E0E',
  tokenSelect: '#0E2222',
  tokenList: '#061414',
  tokenListHighlight: '#2EF2C4',
  claimButtonFrom: '#2EF2C4', // left edge of the button gradient
  claimButtonTo: '#14A8E8', // right edge of the button gradient
} as const;

// Frosted-glass blur behind each element of the token-select box, in px
// (0 = none). With a low opacity and some blur, the forest shows through but
// softened. Blur only shows where something sharp is visible behind the
// element: the button and "Choose a token" sit on the panel, so a high
// FAUCET_CONTROLS_OPACITY.panel hides the forest and leaves little to blur.
// Lower the panel opacity to see their blur. Also, if `panel` blur here is
// above 0, the elements inside it can only blur the panel's own background.
export const FAUCET_CONTROLS_BLUR_PX = {
  panel: 0,
  tokenSelect: 24,
  tokenList: 24,
  claimButton: 24, // "Claim Tokens" while it can be pressed
  claimButtonDisabled: 24, // "Claim Tokens" while it can't be pressed
} as const;

// Procedural cyber forest. Changing the seed reshuffles the trees and motes.
export const FAUCET_FOREST = {
  seed: 7,
  treesFar: 14,
  treesNear: 9,
  motes: 28,
} as const;
