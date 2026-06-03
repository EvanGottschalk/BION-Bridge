export type TokenInfo = {
  symbol: string;
  name: string;
  address: string;
  decimals?: number;
  logoURI?: string;
};

/** Map of symbol (uppercase) to token info for a chain. Include WETH, USDC, and any other swapable tokens. */
export type ChainTokens = Record<string, TokenInfo>;