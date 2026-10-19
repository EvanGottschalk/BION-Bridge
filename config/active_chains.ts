import {
  ETH_MAINNET,
  BASE_MAINNET,
  SOLANA_MAINNET,
  ETH_SEPOLIA,
  BASE_SEPOLIA,
  SOLANA_DEVNET,
  RELAY_CHAIN_INFO,
} from './chain_info';
import { CHAINS, type ChainKey } from './blockchain_config';

export type VmType = 'evm' | 'svm';

export type ChainIconKey = 'ethereum' | 'base' | 'solana';

export type ActiveChain = {
  key: 'ethereum' | 'base' | 'solana' | 'sepolia' | 'baseSepolia' | 'solanaDevnet';
  chainKey: ChainKey; // key into CHAINS / NTT_BRIDGE_INFO / FEE_RECIPIENT_ADDRESSES
  isTestnet: boolean;
  displayName: string;
  shortName: string;
  relayChainId: number;
  vmType: VmType;
  explorerUrl: string;
  explorerQuery?: string; // appended after the tx/account path (e.g. Solscan's devnet cluster flag)
  rpcUrls: string[];
  iconKey: ChainIconKey;
  brandColor: string;
  nativeSymbol: string;
  nativeDecimals: number;
};

const MAINNET_CHAINS: ActiveChain[] = [
  {
    key: 'ethereum',
    chainKey: CHAINS.ETH_MAINNET,
    isTestnet: false,
    displayName: 'Ethereum',
    shortName: 'ETH',
    relayChainId: RELAY_CHAIN_INFO.ethereum.chainId,
    vmType: 'evm',
    explorerUrl: ETH_MAINNET.explorerUrl,
    rpcUrls: ETH_MAINNET.rpcUrls,
    iconKey: 'ethereum',
    brandColor: '#627EEA',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
  },
  {
    key: 'base',
    chainKey: CHAINS.BASE_MAINNET,
    isTestnet: false,
    displayName: 'Base',
    shortName: 'Base',
    relayChainId: RELAY_CHAIN_INFO.base.chainId,
    vmType: 'evm',
    explorerUrl: BASE_MAINNET.explorerUrl,
    rpcUrls: BASE_MAINNET.rpcUrls,
    iconKey: 'base',
    brandColor: '#0052FF',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
  },
  {
    key: 'solana',
    chainKey: CHAINS.SOLANA_MAINNET,
    isTestnet: false,
    displayName: 'Solana',
    shortName: 'SOL',
    relayChainId: RELAY_CHAIN_INFO.solana.chainId,
    vmType: 'svm',
    explorerUrl: SOLANA_MAINNET.explorerUrl,
    rpcUrls: SOLANA_MAINNET.rpcUrls,
    iconKey: 'solana',
    brandColor: '#9945FF',
    nativeSymbol: 'SOL',
    nativeDecimals: 9,
  },
];

// Shown while Test Mode is ON. Relay chain ids are the chains' own ids; Solana
// Devnet uses 901 per the lead's decision (plan 2, §10).
const TESTNET_CHAINS: ActiveChain[] = [
  {
    key: 'sepolia',
    chainKey: CHAINS.ETH_SEPOLIA,
    isTestnet: true,
    displayName: 'Sepolia',
    shortName: 'SEP',
    relayChainId: ETH_SEPOLIA.chainId,
    vmType: 'evm',
    explorerUrl: ETH_SEPOLIA.explorerUrl,
    rpcUrls: ETH_SEPOLIA.rpcUrls,
    iconKey: 'ethereum',
    brandColor: '#627EEA',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
  },
  {
    key: 'baseSepolia',
    chainKey: CHAINS.BASE_SEPOLIA,
    isTestnet: true,
    displayName: 'Base Sepolia',
    shortName: 'Base Sep',
    relayChainId: BASE_SEPOLIA.chainId,
    vmType: 'evm',
    explorerUrl: BASE_SEPOLIA.explorerUrl,
    rpcUrls: BASE_SEPOLIA.rpcUrls,
    iconKey: 'base',
    brandColor: '#0052FF',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
  },
  {
    key: 'solanaDevnet',
    chainKey: CHAINS.SOLANA_DEVNET,
    isTestnet: true,
    displayName: 'Solana Devnet',
    shortName: 'SOL Dev',
    relayChainId: SOLANA_DEVNET.chainId,
    vmType: 'svm',
    explorerUrl: SOLANA_DEVNET.explorerUrl,
    explorerQuery: SOLANA_DEVNET.explorerQuery,
    rpcUrls: SOLANA_DEVNET.rpcUrls,
    iconKey: 'solana',
    brandColor: '#9945FF',
    nativeSymbol: 'SOL',
    nativeDecimals: 9,
  },
];

/** Every chain the app knows about, across both modes. Use for id/key lookups. */
export const ALL_CHAINS: ActiveChain[] = [...MAINNET_CHAINS, ...TESTNET_CHAINS];

export const ACTIVE_CHAINS_BY_MODE = {
  mainnet: MAINNET_CHAINS,
  testnet: TESTNET_CHAINS,
} as const;

export type ActiveChainKey = ActiveChain['key'];

/** Default From → To pair the bridge card resets to for each mode. */
export const DEFAULT_CHAIN_PAIR_BY_MODE: Record<
  'mainnet' | 'testnet',
  { from: ActiveChainKey; to: ActiveChainKey }
> = {
  mainnet: { from: 'solana', to: 'base' },
  testnet: { from: 'solanaDevnet', to: 'baseSepolia' },
};

export const getChainsForMode = (testMode: boolean): ActiveChain[] =>
  testMode ? ACTIVE_CHAINS_BY_MODE.testnet : ACTIVE_CHAINS_BY_MODE.mainnet;

export const getDefaultChainPair = (testMode: boolean) =>
  DEFAULT_CHAIN_PAIR_BY_MODE[testMode ? 'testnet' : 'mainnet'];

export const getActiveChain = (key: ActiveChainKey): ActiveChain => {
  const found = ALL_CHAINS.find((c) => c.key === key);
  if (!found) throw new Error(`Unknown active chain: ${key}`);
  return found;
};

export const getActiveChainByRelayId = (id: number): ActiveChain | undefined =>
  ALL_CHAINS.find((c) => c.relayChainId === id);

export const getActiveChainByChainKey = (chainKey: ChainKey): ActiveChain | undefined =>
  ALL_CHAINS.find((c) => c.chainKey === chainKey);

export const isEvmChainId = (id: number): boolean => {
  const c = getActiveChainByRelayId(id);
  return c?.vmType === 'evm';
};

export const isSolanaChainId = (id: number): boolean => {
  const c = getActiveChainByRelayId(id);
  return c?.vmType === 'svm';
};

export const buildExplorerTxUrl = (chainKey: ActiveChainKey, txHash: string): string => {
  const chain = getActiveChain(chainKey);
  return `${chain.explorerUrl}/tx/${txHash}${chain.explorerQuery ?? ''}`;
};

export const buildExplorerAddressUrl = (chainKey: ActiveChainKey, address: string): string => {
  const chain = getActiveChain(chainKey);
  const path = chain.vmType === 'svm' ? 'account' : 'address';
  return `${chain.explorerUrl}/${path}/${address}${chain.explorerQuery ?? ''}`;
};
