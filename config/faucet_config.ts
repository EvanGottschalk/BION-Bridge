// Faucet page literals: route, copy, tokens, Dorothy's lines, animation timing
// and the cyber-forest palette. See CLAUDE.md Non-Negotiable Rule #1.

import type { StaticImageData } from 'next/image';
import dorothyImage from '../src/image/Dorothy.png';
import * as baseSepoliaTokens from './token_info/base_testnet_sepolia_tokens';
import * as solanaDevnetTokens from './token_info/solana_devnet_tokens';

export const FAUCET_V1_ROUTE = '/faucet/v1';

export const FAUCET_PAGE_META = {
  title: 'Faucet',
  description: 'Claim free testnet tokens from the Aphid cyber faucet, guided by Dorothy.',
} as const;

export const FAUCET_COPY = {
  heading: 'Faucet',
  subheading: 'Free testnet tokens, poured fresh from the cyber forest.',
  tokenLabel: 'Token',
  tokenPlaceholder: 'Choose a token',
  claim: 'Claim Tokens',
  claiming: 'Claiming…',
  connectWallet: (vm: 'evm' | 'svm') =>
    vm === 'svm' ? 'Connect Solana wallet' : 'Connect EVM wallet',
  perClaim: (amount: string, symbol: string) => `${amount} ${symbol} per claim`,
  networkBadge: (network: string) => network,
  walletPlaceholder: 'WALLET', // wallet label before a token is chosen
  sceneAria:'A cyber faucet pouring liquid digital energy into your wallet',
  skipHint: 'Tap to skip',
  claimedAmount: (amount: string, symbol: string) => `+${amount} ${symbol}`,
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
    "Welcome, traveler! I'm glad you made it. We are in the Token Faucet, which you can use to get free cryptocurrency tokens. Use the select list to claim your tokens!",
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
} as const;

export type FaucetVm = 'evm' | 'svm';

export interface FaucetToken {
  id: string; // unique per token + network
  symbol: string;
  name: string;
  iconSymbol: string; // file name under src/image/tokens
  network: string;
  vm: FaucetVm;
  address: string;
  amount: string; // human-readable amount poured per claim
}

export const FAUCET_TOKENS: readonly FaucetToken[] = [
  // {
  //   id: 'tbion-base-sepolia',
  //   symbol: baseSepoliaTokens.TBION.symbol,
  //   name: baseSepoliaTokens.TBION.name,
  //   iconSymbol: 'tBION',
  //   network: 'Base Sepolia',
  //   vm: 'evm',
  //   address: baseSepoliaTokens.TBION.address,
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
  //   amount: '50',
  // },
  {
    id: 'sol-devnet',
    symbol: 'SOL',
    name: 'Devnet SOL',
    iconSymbol: 'SOL Test',
    network: 'Solana Devnet',
    vm: 'svm',
    address: 'native',
    amount: '1',
  },
  {
    id: 'eth-sepolia',
    symbol: 'ETH',
    name: 'Sepolia Ether',
    iconSymbol: 'ETH Test',
    network: 'Ethereum Sepolia',
    vm: 'evm',
    address: 'native',
    amount: '0.05',
  },
] as const;

// The claim is simulated until a faucet backend exists. lib/faucet/claim.ts is
// the single place to wire a real request; this is how long the fake one takes.
export const FAUCET_SIMULATED_CLAIM_MS = 600;

// Animation phases, in milliseconds. Order: turning → charging → falling →
// splash. The reduced-motion variants skip straight to the result.
export const FAUCET_TIMING_MS = {
  turning: 1100, // valve wheel spins, energy runs through the pipe
  charging: 900, // drop swells at the spout
  falling: 650, // drop falls into the wallet
  splash: 1500, // wallet ripples and glows, +amount floats up
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
