// Solana transaction-building and diagnostics constants: program ids, known
// program error codes (for console diagnostics), and the compute-budget /
// priority-fee settings we attach to wallet-signed Wormhole transactions.

export const SOLANA_PROGRAM_IDS = {
  computeBudget: 'ComputeBudget111111111111111111111111111111',
  secp256k1: 'KeccakSecp256k11111111111111111111111111111',
  ed25519: 'Ed25519SigVerify111111111111111111111111111',
  system: '11111111111111111111111111111111',
  token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  token2022: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PeNWqhjXvmPTsBo',
  associatedToken: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  wormholeCoreDevnet: '3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5',
  wormholeCoreMainnet: 'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth',
} as const;

// Names shown in console diagnostics. NTT managers come from NTT_BRIDGE_INFO.
export const SOLANA_PROGRAM_NAMES: Record<string, string> = {
  [SOLANA_PROGRAM_IDS.computeBudget]: 'ComputeBudget',
  [SOLANA_PROGRAM_IDS.secp256k1]: 'Secp256k1 precompile',
  [SOLANA_PROGRAM_IDS.ed25519]: 'Ed25519 precompile',
  [SOLANA_PROGRAM_IDS.system]: 'System',
  [SOLANA_PROGRAM_IDS.token]: 'SPL Token',
  [SOLANA_PROGRAM_IDS.token2022]: 'Token-2022',
  [SOLANA_PROGRAM_IDS.associatedToken]: 'Associated Token Account',
  [SOLANA_PROGRAM_IDS.wormholeCoreDevnet]: 'Wormhole Core Bridge (devnet)',
  [SOLANA_PROGRAM_IDS.wormholeCoreMainnet]: 'Wormhole Core Bridge',
};

const PRECOMPILE_ERRORS: Record<number, string> = {
  0: 'InvalidPublicKey',
  1: 'InvalidRecoveryId',
  2: 'InvalidSignature (or its data offsets point outside the referenced instruction)',
  3: 'InvalidDataOffsets',
  4: 'InvalidInstructionDataSize',
};

const TOKEN_ERRORS: Record<number, string> = {
  0: 'NotRentExempt',
  1: 'InsufficientFunds',
  2: 'InvalidMint',
  3: 'MintMismatch',
  4: 'OwnerMismatch',
  5: 'FixedSupply',
  6: 'AlreadyInUse',
  7: 'InvalidNumberOfProvidedSigners',
  8: 'InvalidNumberOfRequiredSigners',
  9: 'UninitializedState',
  10: 'NativeNotSupported',
  11: 'NonNativeHasBalance',
  12: 'InvalidInstruction',
  13: 'InvalidState',
  14: 'Overflow',
  15: 'AuthorityTypeNotSupported',
  16: 'MintCannotFreeze',
  17: 'AccountFrozen',
  18: 'MintDecimalsMismatch',
  19: 'NonNativeNotSupported',
};

// Custom error codes by program id, for "custom program error: 0x…" decoding.
export const SOLANA_PROGRAM_ERRORS: Record<string, Record<number, string>> = {
  [SOLANA_PROGRAM_IDS.secp256k1]: PRECOMPILE_ERRORS,
  [SOLANA_PROGRAM_IDS.ed25519]: PRECOMPILE_ERRORS,
  [SOLANA_PROGRAM_IDS.system]: {
    0: 'AccountAlreadyInUse',
    1: 'ResultWithNegativeLamports',
    2: 'InvalidProgramId',
    3: 'InvalidAccountDataLength',
    4: 'MaxSeedLengthExceeded',
    5: 'AddressWithSeedMismatch',
    6: 'NonceNoRecentBlockhashes',
    7: 'NonceBlockhashNotExpired',
    8: 'NonceUnexpectedBlockhashValue',
  },
  [SOLANA_PROGRAM_IDS.token]: TOKEN_ERRORS,
  [SOLANA_PROGRAM_IDS.token2022]: TOKEN_ERRORS,
};

// Anchor framework errors (any Anchor program, e.g. the NTT manager). Codes
// ≥ 6000 are program-specific and are reported as such.
export const ANCHOR_FRAMEWORK_ERRORS: Record<number, string> = {
  100: 'InstructionMissing',
  101: 'InstructionFallbackNotFound',
  102: 'InstructionDidNotDeserialize',
  2000: 'ConstraintMut',
  2001: 'ConstraintHasOne',
  2002: 'ConstraintSigner',
  2003: 'ConstraintRaw',
  2006: 'ConstraintSeeds',
  2012: 'ConstraintAddress',
  2014: 'ConstraintTokenMint',
  2015: 'ConstraintTokenOwner',
  3001: 'AccountDiscriminatorNotFound',
  3002: 'AccountDiscriminatorMismatch',
  3003: 'AccountDidNotDeserialize',
  3005: 'AccountNotEnoughKeys',
  3007: 'AccountOwnedByWrongProgram',
  3010: 'AccountNotSigner',
  3012: 'AccountNotInitialized',
};
export const ANCHOR_PROGRAM_ERROR_START = 6000;

export const SOLANA_DIAGNOSTIC_HINTS = {
  precompileOffsets:
    'A signature-verification precompile reads its data from an instruction index fixed when the tx was built. If the wallet inserted instructions (e.g. ComputeBudget priority fees) before it, the offsets point at the wrong instruction.',
  anchorProgramError: 'Program-specific Anchor error; look up this code in the program IDL.',
} as const;

// Compute budget + priority fee appended (at the END, so precompile
// instruction indexes stay valid) to every Wormhole SDK tx before the wallet
// signs. Wallets such as Phantom only add their own (at the FRONT) when a tx
// has none. Mirrors the Wormhole SDK's own signer: simulate for units × 1.2,
// and take the given percentile of recent fees on the tx's writable accounts.
export const SOLANA_PRIORITY_FEE = {
  percentile: 0.5,
  percentileMultiple: 1,
  minMicroLamports: 1,
  maxMicroLamports: 1_000_000, // caps the fee at ~0.00025 SOL for a 250k-CU tx
} as const;

// Secp256k1 / Ed25519 precompile instruction layouts (bytes), used to check
// that their data offsets still point at valid data after the wallet signs.
export const SECP256K1_OFFSETS_LAYOUT = { headerSize: 1, entrySize: 11, signatureSize: 65, ethAddressSize: 20 } as const;
export const ED25519_OFFSETS_LAYOUT = { headerSize: 2, entrySize: 14, signatureSize: 64, publicKeySize: 32, currentInstruction: 0xffff } as const;
