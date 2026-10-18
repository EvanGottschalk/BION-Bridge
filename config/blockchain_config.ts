export const BLOCKCHAIN = 'BASE_MAINNET' as const; // default chain context for backend swap, balance, and AI workflows
export const WRAP_ETH = false; // toggle to wrap native ETH for ERC-20 style swap execution

export const CHAINS = {
  BASE_SEPOLIA: 'BASE_SEPOLIA', // Base testnet key used for backend routing and token config
  ETH_SEPOLIA: 'ETH_SEPOLIA', // Ethereum testnet key used for backend routing and token config
  ETH_MAINNET: 'ETH_MAINNET', // Ethereum mainnet key for production routing and swaps
  BASE_MAINNET: 'BASE_MAINNET', // Base mainnet key for production routing and swaps
  SOLANA_MAINNET: 'SOLANA_MAINNET', // Solana mainnet key for Solana-specific swap logic
  SOLANA_DEVNET: 'SOLANA_DEVNET',
} as const;

export type ChainKey = keyof typeof CHAINS; // union of supported chain identifiers for backend logic

export const GAS_RESERVES = {
  BASE_SEPOLIA: '0.001',
  ETH_SEPOLIA: '0.001',
  ETH_MAINNET: '0.01',
  BASE_MAINNET: '0.0005',
  SOLANA_MAINNET: '0.02',
  SOLANA_DEVNET: '0.01',
};

export const GAS_TOKENS = {
  BASE_SEPOLIA: 'ETH',
  ETH_SEPOLIA: 'ETH',
  ETH_MAINNET: 'ETH',
  BASE_MAINNET: 'ETH',
  SOLANA_MAINNET: 'SOL',
  SOLANA_DEVNET: 'SOL',
};

export const FORCE_QUERY_CHAINS = {
  balances:  {
    login: true,
    refresh: true,
    openWallet: false,
    changeChain: false,
    swapComplete: false,
    swapStart: false
  }
};

export const BALANCE_RULES = {
  staleness: {
    stalenessCheckConditions:  {
      login: true,
      refresh: true,
      openWallet: true,
      changeChain: true,
      swapComplete: true,
    },
    staleTimer: 15 * 60000,
    staleTimerCheckConditions: {
      openWallet: true,
      swapStart: true,
      swapComplete: false,
    }
  }
}

export const PRICE_RULES = {
  fetchAllConditions: {
    periodically: 5, // Measured in minutes. Asynchronously, periodically, the backend pulls all token prices based on the value of PRICE_RULES.fetchAllConditions.periodically
    // login: false, not yet active
    refresh: true, // Runs when the page is opened or refreshed
    // openWallet: false, not yet active
    // changeChain: false, not yet active
    // swapComplete: false, not yet active
    // swapStart: false, not yet active
  }
}

export const DEFAULT_TOKENS = { // These are added when a user creates their account
  ETH_MAINNET: ['ETH', 'WETH', 'WSOL', 'WBTC', 'USDC', 'DAI'],
  ETH_SEPOLIA: ['ETH', 'WETH', 'WSOL', 'WBTC', 'USDC', 'DAI'],
  BASE_MAINNET: ['ETH', 'WETH', 'WSOL', 'WBTC', 'USDC', 'DAI'],
  BASE_SEPOLIA: ['ETH', 'WETH', 'WSOL', 'WBTC', 'USDC', 'DAI'],
  SOLANA_MAINNET: ['SOL', 'WSOL', 'WETH', 'WBTC', 'USDC', 'DAI'],
  SOLANA_DEVNET: ['SOL', 'WSOL', 'WETH', 'WBTC', 'USDC', 'DAI'],
};

export const SWAP_PROVIDER_OPTIONS = {
  maxAttemptsPerOption: 2, // If a swap fails, it should try again with the next provider option in its respective list. It should try each option a number of times equal to maxAttemptsPerOption. So, if maxAttemptsPerOption is 3, it will try each option 3 times. A value of 0 for maxAttemptsPerOption is treated as infinity, and a swap will keep looping through the options indefinitely.
  ETH_MAINNET: [
    '0x v2',
    '0x v1',
  ],
  ETH_SEPOLIA: [
    '0x v2',
    '0x v1',
  ],
  BASE_MAINNET: [
    '0x v2',
    '0x v1',
  ],
  BASE_SEPOLIA: [
    '0x v2',
    '0x v1',
  ],
  SOLANA_MAINNET: [
    'Jupiter Ultra',
  ],
  SOLANA_DEVNET: [
    'Jupiter Ultra',
  ],
  CROSS_CHAIN_SWAP: [
    'Relay',
  ],
  BRIDGE: [
    'Relay',
  ]
}

export const NTT_BRIDGE_INFO = { // tokens bridged via a Wormhole NTT deployment instead of Relay. Keyed by ChainKey; transfers work between any two listed chains, in both directions
  BRDGTST: {
    network: 'Testnet', // Wormhole network the deployment lives on; only offered while Test Mode is ON
    chains: {
      [CHAINS.SOLANA_DEVNET]: {
        tokenContractAddress: '3KEy4DGbNEnMX67QNHHp3sDyXBDy9QzAnbUks8n2wxRL', // Token-2022 mint, 9 decimals
        NTTcontractAddress: 'BRdDtfZ1obCVAwnXA3MNfFf5NR4zEoJKutqCyKjJWw7N', // NTT manager program
        NTTtransceiverAddress: 'BRdDtfZ1obCVAwnXA3MNfFf5NR4zEoJKutqCyKjJWw7N', // Solana NTT embeds the Wormhole transceiver in the manager program
        mode: 'locking', // hub; on-chain config mode 0, tokens held in custody 8HCmwLzh8pBJDnbbRnMGRD2Gm76K7ALUMYGMkut5mg7E
      },
      [CHAINS.BASE_SEPOLIA]: {
        tokenContractAddress: '0x27f73ff4f073B4Bf98f910B52F522eDc4778eDaA', // ERC-20, 9 decimals
        NTTcontractAddress: '0x52F00C4A1f38979dB0B729AAb4Ea0a203A499A3B', // NttManager v2.0.0
        NTTtransceiverAddress: '0xF20e4e381E14405E1eB9DdD80cbEF9e4bf0ecFe8', // WormholeTransceiver, read from NttManager.getTransceivers()
        mode: 'burning', // spoke; NttManager.getMode() === 1, mints on inbound and burns on outbound
      },
    },
  },
} as const;