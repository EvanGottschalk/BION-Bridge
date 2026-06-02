import { RELAY_FEE_RECIPIENT } from '@/config/fees_config';
import {
  RELAY_APP_FEE_BPS,
  RELAY_DEFAULT_TRADE_TYPE,
  NATIVE_EVM_ADDRESS,
  NATIVE_SOL_ADDRESS,
} from '@/config/relay_config';
import { getActiveChain, type ActiveChainKey } from '@/config/active_chains';
import type { TokenInfo } from '@/config/token_info';
import type {
  RelayQuoteRequest,
  RelayQuoteResponse,
  RelayTradeType,
} from './types';

export type BuildQuoteArgs = {
  fromChain: ActiveChainKey;
  toChain: ActiveChainKey;
  fromToken: TokenInfo;
  toToken: TokenInfo;
  amount: string; // human-readable units
  user: string; // wallet address on the origin chain (case-sensitive for Solana)
  recipient?: string; // address on the destination chain
  tradeType?: RelayTradeType;
  appFeeBps?: number;
  refundTo?: string;
};

export const toBaseUnits = (human: string, decimals: number): bigint => {
  if (!human) return 0n;
  const trimmed = human.trim();
  if (!/^\d*(?:\.\d*)?$/.test(trimmed)) {
    throw new Error(`Invalid numeric amount: ${human}`);
  }
  const [whole, frac = ''] = trimmed.split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const wholePart = whole === '' ? 0n : BigInt(whole);
  const fracPart = fracPadded === '' ? 0n : BigInt(fracPadded);
  return wholePart * 10n ** BigInt(decimals) + fracPart;
};

export const fromBaseUnits = (base: string | bigint, decimals: number): string => {
  const b = typeof base === 'bigint' ? base : BigInt(base);
  const negative = b < 0n;
  const abs = negative ? -b : b;
  const denom = 10n ** BigInt(decimals);
  const whole = abs / denom;
  const frac = abs % denom;
  if (decimals === 0) return `${negative ? '-' : ''}${whole.toString()}`;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${fracStr ? `.${fracStr}` : ''}`;
};

const normalizeOriginCurrency = (token: TokenInfo, chain: ActiveChainKey): string => {
  if (token.address) return token.address;
  return getActiveChain(chain).vmType === 'svm' ? NATIVE_SOL_ADDRESS : NATIVE_EVM_ADDRESS;
};

export const buildQuoteRequest = (args: BuildQuoteArgs): RelayQuoteRequest => {
  const origin = getActiveChain(args.fromChain);
  const destination = getActiveChain(args.toChain);
  const decimals = args.fromToken.decimals ?? 18;
  const amount = toBaseUnits(args.amount, decimals).toString();

  const req: RelayQuoteRequest = {
    user: args.user,
    originChainId: origin.relayChainId,
    destinationChainId: destination.relayChainId,
    originCurrency: normalizeOriginCurrency(args.fromToken, args.fromChain),
    destinationCurrency: normalizeOriginCurrency(args.toToken, args.toChain),
    amount,
    tradeType: args.tradeType ?? RELAY_DEFAULT_TRADE_TYPE,
    recipient: args.recipient ?? args.user,
    refundTo: args.refundTo ?? args.user,
  };

  const bps = args.appFeeBps ?? RELAY_APP_FEE_BPS;
  if (bps > 0) {
    req.appFees = [{ recipient: RELAY_FEE_RECIPIENT, fee: String(bps) }];
  }
  return req;
};

export type ParsedQuote = {
  raw: RelayQuoteResponse;
  outputAmountFormatted: string;
  outputAmountUsd?: string;
  outputSymbol: string;
  rate?: string;
  feeBreakdownUsd: {
    gas?: string;
    relayer?: string;
    relayerService?: string;
    relayerGas?: string;
    app?: string;
    subsidized?: string;
    totalImpactUsd?: string;
    totalImpactPercent?: string;
  };
  timeEstimateSeconds?: number;
  slippagePercent?: string;
  requestIds: string[];
};

export const parseQuote = (resp: RelayQuoteResponse): ParsedQuote => {
  const details = resp.details;
  const fees = resp.fees ?? {};
  return {
    raw: resp,
    outputAmountFormatted: details?.currencyOut?.amountFormatted ?? '0',
    outputAmountUsd: details?.currencyOut?.amountUsd,
    outputSymbol: details?.currencyOut?.currency?.symbol ?? '',
    rate: details?.rate,
    feeBreakdownUsd: {
      gas: fees.gas?.amountUsd,
      relayer: fees.relayer?.amountUsd,
      relayerService: fees.relayerService?.amountUsd,
      relayerGas: fees.relayerGas?.amountUsd,
      app: fees.app?.amountUsd,
      subsidized: fees.subsidized?.amountUsd,
      totalImpactUsd: details?.totalImpact?.usd,
      totalImpactPercent: details?.totalImpact?.percent,
    },
    timeEstimateSeconds: details?.timeEstimate,
    slippagePercent: details?.slippageTolerance?.destination?.percent,
    requestIds: Array.from(new Set(resp.steps.map((s) => s.requestId).filter(Boolean))),
  };
};
