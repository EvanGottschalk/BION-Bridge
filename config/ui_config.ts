// Centralised UI literals so components don't hardcode brand colors or copy.
// See CLAUDE.md Non-Negotiable Rule #1.

export const BRAND_PRIMARY = '#4A6CF7';
export const BRAND_PRIMARY_SOFT = 'rgba(74,108,247,0.25)';
export const BRAND_SILVER = '#C0C8D8';
export const BRAND_ACCENT = '#8B9FFF';

export const RAINBOW_KIT_THEME_ACCENT = BRAND_PRIMARY;

export const BRIDGE_LOGO_URL =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/a9f1d408-e45b-45f7-b6b8-2ad075c052c3_r-pgxvhoPUPBXjXE407UUVaHfcYcAIeQ.png';

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
  { label: 'Powered by Aphid', href: 'https://aphid.com' },
  { label: 'BION', href: 'https://www.bionfoundation.org/' },
  { label: '', href: '#' },
] as const;

export const FOOTER_LEGAL_LINKS = [
  { label: 'Terms', href: '#' },
  { label: 'Privacy', href: '#' },
  { label: '', href: '#' },
] as const;

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