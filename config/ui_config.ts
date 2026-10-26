// Centralised UI literals so components don't hardcode brand colors or copy.
// See CLAUDE.md Non-Negotiable Rule #1.

import type { StaticImageData } from 'next/image';
import heroImage from '../src/image/hero_image.png';
import logoImage from '../src/image/logo.png';

export const BRAND_PRIMARY = '#4A6CF7';
export const BRAND_PRIMARY_SOFT = 'rgba(74,108,247,0.25)';
export const BRAND_SILVER = '#C0C8D8';
export const BRAND_ACCENT = '#8B9FFF';

export const RAINBOW_KIT_THEME_ACCENT = BRAND_PRIMARY;

// Swap to a string URL (e.g. 'https://…/hero.png') to serve remotely instead
// of from the bundled asset under src/image.
export const HERO_IMAGE_LOCATION: string | StaticImageData = heroImage;

export const LOGO_IMAGE = {
  asset: logoImage,
  href: '/',
  size: 50,
  paddingLeft: 0,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
};

export const BRIDGE_HERO_COPY =
  'Seamlessly transfer tokens between supported networks with lightning speed and minimal fees.';

export const APP_NAME = 'Aphid';
export const APP_LINK = 'https://aphid.com';
export const APP_PARTNERS = [
  {
    label: 'BION Token',
    href: 'https://www.bionfoundation.org/',
  },
  {
    label: 'BION DAO',
    href: 'https://www.bionfoundation.org/',
  }
] as const;

export const APP_TITLE = 'AEX — Cross-Chain Token Bridge';
export const APP_DESCRIPTION =
  'Bridge tokens seamlessly across Solana, Base, and Ethereum. Powered by Bion DAO & Bion Foundation.';
export const APP_THEME_COLOR = '#000000';

export const NAV_LINKS = [
  { label: 'Bridge', href: '/' },
  { label: 'Powered by Aphid', href: 'https://aphid.com' },
  { label: 'BION Token', href: 'https://www.bionfoundation.org/' },
] as const;

import { TERMS_ROUTE, PRIVACY_ROUTE } from './legal_config';

export const FOOTER_LEGAL_LINKS = [
  { label: 'Terms', href: TERMS_ROUTE },
  { label: 'Privacy', href: PRIVACY_ROUTE },
  { label: '', href: '#' },
] as const;

export const LEGAL_PAGE_LAST_UPDATED_LABEL = 'Last updated';

export const QUOTE_FEE_LABEL_BPS_FALLBACK = '0.5% fee';
export const QUOTE_DEFAULT_ETA_LABEL = '~2 min';

// Placeholder stats shown before an indexer-backed feed is wired up.
export const STATS_DISPLAY = {
  displayModeOptions: ['hidden', 'string'],
  bridges:
    {
      displayMode: 'hidden',
      string: '12.4K'
    },
  volume: 
    {
      displayMode: 'hidden',
      string: '$2.1M'
    },
  users: 
    {
      displayMode: 'hidden',
      string: '3.2K'
    },
  } as const;

// Status modal copy keyed to Relay's status enum.
export const STATUS_COPY: Record<string, { title: string; body: string }> = {
  awaiting: { title: 'Awaiting wallet', body: 'Confirm the transaction in your wallet.' },
  waiting: { title: 'Submitting deposit', body: 'Broadcasting your deposit to the origin chain.' },
  pending: { title: 'Solver filling', body: 'Relay’s solver is preparing the destination transaction.' },
  submitted: { title: 'Destination tx sent', body: 'Waiting for confirmation on the destination chain.' },
  success: { title: 'Complete', body: 'Your funds have arrived.' },
  delayed: { title: 'Taking longer than usual', body: 'Still processing on the destination chain.' },
  failure: { title: 'Failed', body: 'The fill could not be completed.' },
  refunded: { title: 'Refunded', body: 'Your deposit was refunded.' },
  refund: { title: 'Refund in progress', body: 'A refund is being issued.' },
};

// Test Mode toggle in the bridge card header. Set TEST_MODE_TOGGLE_VISIBLE to
// false to hide it; the app then always runs with Test Mode OFF (mainnet).
export const TEST_MODE_TOGGLE_VISIBLE = true;
export const TEST_MODE_COPY = {
  label: 'Test Mode',
  on: 'ON',
  off: 'OFF',
  liveBadge: 'Live',
  testnetBadge: 'Testnet',
  operational: 'Operational',
  phantomHint: 'Using Phantom? Turn on Testnet Mode in its settings to see devnet balances.',
} as const;

export const BRIDGE_CARD_COPY = {
  title: 'Bridge',
  fromLabel: 'From',
  toLabel: 'To',
  tokenLabel: 'Token',
  amountLabel: 'Amount',
  receiveLabel: 'You Receive',
  amountPlaceholder: '0.00',
  swapSidesAria: 'Swap chains',
  bridging: 'Bridging…',
} as const;

export const BRIDGE_BUTTON_COPY = {
  connectSolana: 'Connect Solana wallet',
  connectEvm: 'Connect EVM wallet',
  selectTokens: 'Select tokens',
  enterAmount: 'Enter amount',
  insufficientBalance: 'Insufficient balance',
  fetchingQuote: 'Fetching quote…',
  quoteFailed: 'Quote failed',
  awaitingQuote: 'Awaiting quote',
  exceedsCapacity: 'Exceeds bridge capacity',
  insufficientGas: 'Insufficient gas for relay fee',
  redeem: 'Redeem',
  redeeming: 'Redeeming…',
  connectToRedeem: (vm: 'evm' | 'svm') =>
    vm === 'svm' ? 'Connect Solana wallet to redeem' : 'Connect EVM wallet to redeem',
  swap: (from: string, to: string) => `Swap ${from} → ${to}`,
  bridge: (symbol: string) => `Bridge ${symbol}`,
} as const;

export const BRIDGE_PROVIDER_COPY = {
  relay: { securedBy: 'Secured by Relay' },
  ntt: { securedBy: 'Secured by Wormhole NTT' },
} as const;

// Badge shown next to tokens that bridge via a Wormhole NTT deployment.
export const NTT_TOKEN_BADGE = 'NTT';

export const QUOTE_ROW_LABELS = {
  rate: 'Rate',
  outputValue: 'Output value',
  gas: 'Gas',
  relayerFee: 'Relayer fee',
  appFee: 'App fee',
  priceImpact: 'Price impact',
  slippage: 'Slippage',
  relayFee: 'Relay fee',
  bridgeFee: 'Bridge fee',
  delivery: 'Delivery',
} as const;

export const NTT_QUOTE_COPY = {
  delivery: 'Redeem on destination',
  capacityError: (available: string, symbol: string) =>
    `Exceeds bridge capacity (${available} ${symbol} available right now).`,
  capacityWarning: 'This amount is close to the destination rate limit and may be delayed.',
  notNttRoute: 'This token pair is not an NTT route.',
  quoteExpired: 'The relay quote expired. Please try again.',
  recipientRequired: 'Connect a destination wallet to receive the tokens.',
  walletRequired: (vm: 'evm' | 'svm') =>
    vm === 'svm' ? 'Connect a Solana wallet to continue.' : 'Connect an EVM wallet to continue.',
} as const;

export const SWAP_PROGRESS_COPY = {
  submittingTitle: 'Submitting',
  confirmInWallet: 'Confirm the transactions in your wallet.',
  txBroadcast: 'Transaction broadcast. Waiting for solver…',
  sigSubmitted: 'Signature submitted.',
  originTx: 'Origin transaction',
  destinationTx: 'Destination transaction',
  wormholescan: 'View on Wormholescan',
  done: 'Done',
  close: 'Close',
  redeem: 'Redeem',
  redeeming: 'Redeeming…',
  viewStatus: 'View transfer status',
  noRequestId: 'Could not find a requestId to poll.',
  swapFailed: 'Swap failed',
  unknownError: 'Unknown error',
} as const;

// Backup "Redeem" panel below the primary button, for NTT transfers the
// primary button can't redeem (e.g. sent from another browser).
export const NTT_REDEEM_COPY = {
  toggle: 'Redeem past transfers',
  explainer: (fromChain: string, toChain: string) =>
    `Have a ${fromChain} transfer that was never redeemed on ${toChain}? Paste the ${fromChain} transaction hash and redeem it here.`,
  inputLabel: 'Source transaction hash',
  inputPlaceholder: 'Transaction hash',
  redeem: 'Redeem',
  connectWallet: (vm: 'evm' | 'svm') =>
    vm === 'svm' ? 'Connect Solana wallet to redeem' : 'Connect EVM wallet to redeem',
  payerNote: (toChain: string) =>
    `Your connected wallet pays the ${toChain} gas. Tokens go to the recipient set when the transfer was sent.`,
  lookingUp: 'Looking up your transfer on Wormhole…',
  notSignedYet:
    'Wormhole Guardians have not signed this transfer yet. Wait for the source chain to finalize, then try again.',
  wrongRoute: 'That transaction is not a transfer to this destination chain.',
} as const;

// "Show Past Transactions" list inside the Redeem past transfers panel.
export const NTT_HISTORY_COPY = {
  show: 'Show Past Transactions',
  hide: 'Hide Past Transactions',
  loading: 'Loading past transactions…',
  empty: 'No past bridge transactions found for your connected wallets.',
  connectWallet: 'Connect a wallet to see your past transactions.',
  loadFailed: 'Could not load past transactions. Please try again.',
  retry: 'Retry',
  copyTx: 'Copy transaction hash',
  copied: 'Copied',
  viewTx: 'View transaction',
  redeem: 'Redeem',
  connectToRedeem: (vm: 'evm' | 'svm') =>
    vm === 'svm' ? 'Connect a Solana wallet to redeem' : 'Connect an EVM wallet to redeem',
  status: {
    checking: 'Checking…',
    pending: 'Awaiting signatures',
    queued: 'Queued',
    redeemed: 'Redeemed',
    unknown: 'Unavailable',
  },
} as const;
export const NTT_HISTORY_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};
export const NTT_HISTORY_TX_TRUNCATE = { head: 6, tail: 4 } as const;

// Status copy for NTT transfers, keyed to Wormhole TransferState milestones.
export const NTT_STATUS_COPY = {
  sourceInitiated: {
    title: 'Transfer submitted',
    body: 'Waiting for the source chain to finalize your transfer.',
  },
  attested: {
    title: 'Ready to redeem',
    body: 'Wormhole Guardians signed your transfer. Click Redeem to receive your tokens on the destination chain.',
  },
  redeemNote: 'Redeeming needs a little native gas on the destination chain.',
  destinationInitiated: {
    title: 'Delivering',
    body: 'Waiting for confirmation on the destination chain.',
  },
  destinationQueued: {
    title: 'Queued by rate limit',
    body: 'The destination rate limit queued this transfer. It can be finalized after the release time.',
  },
  success: { title: 'Complete', body: 'Your tokens have arrived.' },
  relayFailed: {
    title: 'Automatic delivery failed',
    body: 'Your tokens are safe. Redeem manually on the destination chain to finish the transfer.',
  },
  stalled: {
    title: 'Taking longer than usual',
    body: 'Delivery has not completed yet. You can redeem manually on the destination chain.',
  },
  failure: { title: 'Failed', body: 'The transfer could not be completed.' },
  closeNote: 'You can close this window. The transfer continues on-chain and tracking resumes when you return.',
  queueRelease: (when: string) => `Release time: ${when}`,
} as const;

export const TOKEN_ICONS = {
  fileType: 'webp',
  fileSize: '64px',
};

export const WALLET_MODAL_COPY = {
  copyAddress: 'Copy Address',
  copyAddressDone: 'Copied!',
  disconnect: 'Disconnect',
  close: 'Close',
} as const;

export const WALLET_COPY_FEEDBACK_MS = 1600;

// Route handler path for streaming icons from src/image/tokens.
// Update this if the route handler is ever moved.
export const TOKEN_ICON_URL = (symbol: string): string =>
  `/token-icon/${encodeURIComponent(symbol)}`;

// logo.dev crypto-logo API. Used as a fallback when we don't have a local
// icon for a token. https://www.logo.dev/docs/introduction
export const LOGO_DEV_API_KEY_ENV = 'NEXT_PUBLIC_LOGO_DEV_API_KEY';
export const LOGO_DEV_BASE = 'https://img.logo.dev/crypto';
export const LOGO_DEV_FORMAT = 'webp';
export const LOGO_DEV_SIZE = 128;
export const LOGO_DEV_RETINA = true;

export const TOKEN_ICON_LOGO_DEV_URL = (symbol: string): string | undefined => {
  const key = process.env.NEXT_PUBLIC_LOGO_DEV_API_KEY;
  if (!key) return undefined;
  const params = new URLSearchParams({
    token: key,
    format: LOGO_DEV_FORMAT,
    size: String(LOGO_DEV_SIZE),
    retina: String(LOGO_DEV_RETINA),
  });
  return `${LOGO_DEV_BASE}/${encodeURIComponent(symbol.toUpperCase())}?${params.toString()}`;
};