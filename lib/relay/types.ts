export type RelayTradeType = 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'EXPECTED_OUTPUT';

export type RelayAppFee = {
  recipient: string;
  fee: string;
};

export type RelayQuoteRequest = {
  user: string;
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  amount: string;
  tradeType: RelayTradeType;
  recipient?: string;
  refundTo?: string;
  appFees?: RelayAppFee[];
  slippageTolerance?: string;
  referrer?: string;
};

export type RelayCurrency = {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  metadata?: {
    logoURI?: string;
    verified?: boolean;
    isNative?: boolean;
  };
};

export type RelayCurrencyAmount = {
  currency: RelayCurrency;
  amount: string;
  amountFormatted: string;
  amountUsd: string;
  minimumAmount?: string;
};

export type RelayFees = {
  gas?: RelayCurrencyAmount;
  relayer?: RelayCurrencyAmount;
  relayerGas?: RelayCurrencyAmount;
  relayerService?: RelayCurrencyAmount;
  app?: RelayCurrencyAmount;
  subsidized?: RelayCurrencyAmount;
};

export type RelayQuoteDetails = {
  operation?: string;
  sender?: string;
  recipient?: string;
  currencyIn: RelayCurrencyAmount;
  currencyOut: RelayCurrencyAmount;
  refundCurrency?: RelayCurrencyAmount;
  currencyGasTopup?: RelayCurrencyAmount;
  totalImpact?: { usd: string; percent: string };
  swapImpact?: { usd: string; percent: string };
  rate?: string;
  slippageTolerance?: {
    origin?: { usd: string; value: string; percent: string };
    destination?: { usd: string; value: string; percent: string };
  };
  timeEstimate?: number;
  userBalance?: string;
};

export type RelayStepKind = 'transaction' | 'signature';

export type RelayTransactionData = {
  from?: string;
  to?: string;
  data?: string;
  value?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  chainId: number;
  // Solana steps may include a serialized transaction blob instead of EVM fields.
  instructions?: unknown;
  // Catch-all so unknown vm-specific fields survive the parse.
  [key: string]: unknown;
};

export type RelaySignatureData = {
  signatureKind?: string;
  message?: unknown;
  domain?: unknown;
  types?: unknown;
  primaryType?: string;
  post?: { endpoint: string; method: string };
  [key: string]: unknown;
};

export type RelayStepItem = {
  status: 'incomplete' | 'complete';
  data: RelayTransactionData | RelaySignatureData;
  check?: { endpoint: string; method: string };
};

export type RelayStep = {
  id: string;
  action: string;
  description: string;
  kind: RelayStepKind;
  requestId: string;
  items: RelayStepItem[];
};

export type RelayQuoteResponse = {
  steps: RelayStep[];
  fees?: RelayFees;
  details?: RelayQuoteDetails;
  protocol?: unknown;
};

export type RelayStatus =
  | 'waiting'
  | 'pending'
  | 'submitted'
  | 'success'
  | 'delayed'
  | 'refunded'
  | 'refund'
  | 'failure';

export type RelayStatusResponse = {
  status: RelayStatus;
  details?: string;
  inTxHashes?: string[];
  txHashes?: string[];
  updatedAt?: number;
  originChainId?: number;
  destinationChainId?: number;
};

export type RelayCurrenciesRequest = {
  defaultList?: boolean;
  chainIds?: number[];
  term?: string;
  address?: string;
  currencyId?: string;
  tokens?: string[];
  verified?: boolean;
  limit?: number;
  includeAllChains?: boolean;
  useExternalSearch?: boolean;
  depositAddressOnly?: boolean;
};

export type RelayCurrencyListResponse = RelayCurrency[];

export type RelayChain = {
  id: number;
  name: string;
  displayName: string;
  httpRpcUrl?: string;
  wsRpcUrl?: string;
  explorerUrl?: string;
  vmType: 'evm' | 'svm' | 'bvm' | 'tvm' | 'tonvm' | 'suivm' | 'hypevm' | 'lvm';
  disabled?: boolean;
  blockProductionLagging?: boolean;
  depositEnabled?: boolean;
  currency?: RelayCurrency;
};

export type RelayChainsResponse = { chains: RelayChain[] };
