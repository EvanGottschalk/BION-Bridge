import {
  ETH_MAINNET,
  BASE_MAINNET,
  SOLANA_MAINNET,
  RELAY_CHAIN_INFO,
} from './chain_info';

export type VmType = 'evm' | 'svm';

export type ActiveChain = {
  key: 'ethereum' | 'base' | 'solana';
  displayName: string;
  shortName: string;
  relayChainId: number;
  vmType: VmType;
  explorerUrl: string;
  rpcUrls: string[];
  iconKey: 'ethereum' | 'base' | 'solana';
  brandColor: string;
  nativeSymbol: string;
  nativeDecimals: number;
};

export const ACTIVE_CHAINS: ActiveChain[] = [
  {
    key: 'ethereum',
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

export type ActiveChainKey = ActiveChain['key'];

export const getActiveChain = (key: ActiveChainKey): ActiveChain => {
  const found = ACTIVE_CHAINS.find((c) => c.key === key);
  if (!found) throw new Error(`Unknown active chain: ${key}`);
  return found;
};

export const getActiveChainByRelayId = (id: number): ActiveChain | undefined =>
  ACTIVE_CHAINS.find((c) => c.relayChainId === id);

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
  if (chain.vmType === 'svm') return `${chain.explorerUrl}/tx/${txHash}`;
  return `${chain.explorerUrl}/tx/${txHash}`;
};

export const buildExplorerAddressUrl = (chainKey: ActiveChainKey, address: string): string => {
  const chain = getActiveChain(chainKey);
  if (chain.vmType === 'svm') return `${chain.explorerUrl}/account/${address}`;
  return `${chain.explorerUrl}/address/${address}`;
};
