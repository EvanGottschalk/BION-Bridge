// Fee Prioritization:
//  1. UNIVERSAL_FEES.ALL
//  2. UNIVERSAL_FEES specific to action
//  3. EVM.ALL / SVM.ALL / BRIDGING.ALL
//  4. EVM / SVM / BRIDGING specific to action, but the same across platforms
//  5. EVM.[platform].ALL / SVM.[platform].ALL / BRIDGING.[platform].ALL
//  6. EVM.[platform] / SVM.[platform] / BRIDGING.[platform] specific to action and platform

export const FEE_RECIPIENT_ADDRESSES = { // TEST WALLET 4
    ETH_MAINNET: '0x458023587Bd5bfBF648106605f294cC4A1714072',
    ETH_SEPOLIA: '0x458023587Bd5bfBF648106605f294cC4A1714072',
    BASE_SEPOLIA: '0x458023587Bd5bfBF648106605f294cC4A1714072',
    BASE_MAINNET: '0x458023587Bd5bfBF648106605f294cC4A1714072',
    SOLANA_MAINNET: 'GRfrussaJLvherAnBNCSFh9zN1LMFM26FFEQBCN4N4fc',
    SOLANA_DEVNET: 'GRfrussaJLvherAnBNCSFh9zN1LMFM26FFEQBCN4N4fc',
    CROSS_CHAIN_SWAP: '0x458023587Bd5bfBF648106605f294cC4A1714072',
    BRIDGE: '0x458023587Bd5bfBF648106605f294cC4A1714072'
};


// Relay uses a single wallet address for fee accumulation across all chains.
// This wallet will claim fees via Relay's /app-fees/{wallet}/claim API.
export const RELAY_FEE_RECIPIENT = '0x458023587Bd5bfBF648106605f294cC4A1714072';

export const REFERRAL_ACCOUNTS = {
    Jupiter: {
        SwapAndTrigger: '',
        Ultra: ''
    }
};

export const UNIVERSAL_FEES = {
    ALL: 0.5,
    singleChainSwap: null,
    crossChainSwap: null,
    bridge: null,
    liquidityPoolDeposit: null,
    loanDeposit: null
};

export const EVM_FEES = {
    ALL: null,
    singleChainSwap: null,
    liquidityPoolDeposit: null,
    loanDeposit: null,
    '0x': {
        ALL: null,
        singleChainSwap: null,
        liquidityPoolDeposit: null,
        loanDeposit: null
    }
}

export const SVM_FEES = {
    ALL: null,
    singleChainSwap: null,
    liquidityPoolDeposit: null,
    loanDeposit: null,
    Helius: {
        singleChainSwap: null,
        liquidityPoolDeposit: null,
        loanDeposit: null
    }
}

export const BRIDGING_FEES = {
    ALL: null,
    singleChainSwap: null,
    crossChainSwap: null,
    Relay: {
        singleChainSwap: null,
        crossChainSwap: null,
    }
};