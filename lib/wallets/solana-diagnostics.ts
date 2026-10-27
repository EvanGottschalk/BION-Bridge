// Structural helpers for wallet-signed Solana transactions: a pre-send check
// that signature-verification precompiles still point at valid data, and
// detailed console diagnostics when a send fails. Works on transactions from
// any copy of @solana/web3.js (the Wormhole SDK bundles its own).

import type { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import {
  ANCHOR_FRAMEWORK_ERRORS,
  ANCHOR_PROGRAM_ERROR_START,
  ED25519_OFFSETS_LAYOUT,
  SECP256K1_OFFSETS_LAYOUT,
  SOLANA_DIAGNOSTIC_HINTS,
  SOLANA_PROGRAM_ERRORS,
  SOLANA_PROGRAM_IDS,
  SOLANA_PROGRAM_NAMES,
} from '@/config/solana_config';
import { NTT_BRIDGE_INFO } from '@/config/blockchain_config';

const LOG_PREFIX = '[solana]';

type AnyTx = Transaction | VersionedTransaction;
export type InstructionSummary = { index: number; programId: string; data: Uint8Array };

const isVersioned = (tx: AnyTx): tx is VersionedTransaction => 'version' in tx;

export const summarizeInstructions = (tx: AnyTx): InstructionSummary[] => {
  if (isVersioned(tx)) {
    const keys = tx.message.staticAccountKeys; // program ids are never in lookup tables
    return tx.message.compiledInstructions.map((ix, index) => ({
      index,
      programId: keys[ix.programIdIndex]?.toBase58() ?? '?',
      data: ix.data,
    }));
  }
  return tx.instructions.map((ix, index) => ({
    index,
    programId: ix.programId.toBase58(),
    data: ix.data,
  }));
};

// NTT manager program ids from config, so diagnostics can name them.
const nttProgramNames = (): Record<string, string> => {
  const names: Record<string, string> = {};
  for (const [symbol, d] of Object.entries(NTT_BRIDGE_INFO)) {
    for (const entry of Object.values(d.chains)) {
      if (entry) names[entry.NTTcontractAddress] = `${symbol} NTT manager`;
    }
  }
  return names;
};

const programName = (id: string): string => SOLANA_PROGRAM_NAMES[id] ?? nttProgramNames()[id] ?? id;

const u16 = (d: Uint8Array, o: number): number => d[o] | (d[o + 1] << 8);

export type PrecompileProblem = {
  instruction: number;
  program: string;
  entry: number;
  field: string;
  referencedInstruction: number;
  needed: number; // bytes the field needs from offset 0 of the referenced instruction's data
  available: number | null; // null: the referenced instruction doesn't exist
};

/**
 * Secp256k1 / Ed25519 precompile instructions read signature, key and message
 * bytes from instruction indexes fixed when the tx was built. Returns every
 * reference that no longer lands inside the referenced instruction's data —
 * the symptom of a wallet inserting instructions in front of them.
 */
export const findPrecompileOffsetProblems = (tx: AnyTx): PrecompileProblem[] => {
  const ixs = summarizeInstructions(tx);
  const problems: PrecompileProblem[] = [];
  const check = (
    owner: InstructionSummary,
    entry: number,
    field: string,
    ixIndex: number,
    offset: number,
    size: number
  ) => {
    const target = ixs[ixIndex];
    const needed = offset + size;
    if (!target || target.data.length < needed) {
      problems.push({
        instruction: owner.index,
        program: programName(owner.programId),
        entry,
        field,
        referencedInstruction: ixIndex,
        needed,
        available: target ? target.data.length : null,
      });
    }
  };

  for (const ix of ixs) {
    const d = ix.data;
    if (ix.programId === SOLANA_PROGRAM_IDS.secp256k1 && d.length >= SECP256K1_OFFSETS_LAYOUT.headerSize) {
      const L = SECP256K1_OFFSETS_LAYOUT;
      for (let i = 0; i < d[0]; i++) {
        const o = L.headerSize + i * L.entrySize;
        if (o + L.entrySize > d.length) break;
        check(ix, i, 'signature', d[o + 2], u16(d, o), L.signatureSize);
        check(ix, i, 'ethAddress', d[o + 5], u16(d, o + 3), L.ethAddressSize);
        check(ix, i, 'message', d[o + 10], u16(d, o + 6), u16(d, o + 8));
      }
    } else if (ix.programId === SOLANA_PROGRAM_IDS.ed25519 && d.length >= ED25519_OFFSETS_LAYOUT.headerSize) {
      const L = ED25519_OFFSETS_LAYOUT;
      const at = (raw: number) => (raw === L.currentInstruction ? ix.index : raw);
      for (let i = 0; i < d[0]; i++) {
        const o = L.headerSize + i * L.entrySize;
        if (o + L.entrySize > d.length) break;
        check(ix, i, 'signature', at(u16(d, o + 2)), u16(d, o), L.signatureSize);
        check(ix, i, 'publicKey', at(u16(d, o + 6)), u16(d, o + 4), L.publicKeySize);
        check(ix, i, 'message', at(u16(d, o + 12)), u16(d, o + 8), u16(d, o + 10));
      }
    }
  }
  return problems;
};

const instructionTable = (tx: AnyTx) =>
  summarizeInstructions(tx).map((ix) => ({
    index: ix.index,
    program: programName(ix.programId),
    programId: ix.programId,
    dataBytes: ix.data.length,
  }));

/** Console report for a tx that was blocked before sending. */
export const logPrecompileProblems = (context: string, tx: AnyTx, problems: PrecompileProblem[]) => {
  console.error(`${LOG_PREFIX} ${context}: blocked before sending — signature-verification data offsets are invalid.`, {
    hint: SOLANA_DIAGNOSTIC_HINTS.precompileOffsets,
    problems,
    instructions: instructionTable(tx),
  });
};

// Simulation text ("Instruction 2: custom program error: 0x2") and on-chain
// status JSON ({"InstructionError":[2,{"Custom":2}]}).
const CUSTOM_ERROR_RE = /Instruction (\d+): custom program error: (0x[0-9a-fA-F]+)/;
const STATUS_ERROR_RE = /"InstructionError":\[(\d+),\{"Custom":(\d+)\}\]/;

const parseCustomError = (message: string): { index: number; code: number } | undefined => {
  const sim = CUSTOM_ERROR_RE.exec(message);
  if (sim) return { index: Number(sim[1]), code: parseInt(sim[2], 16) };
  const status = STATUS_ERROR_RE.exec(message);
  if (status) return { index: Number(status[1]), code: Number(status[2]) };
  return undefined;
};

const decodeCustomError = (tx: AnyTx | undefined, message: string) => {
  const parsed = parseCustomError(message);
  if (!parsed) return undefined;
  const { index, code } = parsed;
  const programId = tx ? summarizeInstructions(tx)[index]?.programId : undefined;
  const known = programId ? SOLANA_PROGRAM_ERRORS[programId]?.[code] : undefined;
  // Only a guess for unknown programs: Anchor programs share these codes.
  const anchor =
    code >= ANCHOR_PROGRAM_ERROR_START
      ? SOLANA_DIAGNOSTIC_HINTS.anchorProgramError
      : ANCHOR_FRAMEWORK_ERRORS[code] && `If an Anchor program: ${ANCHOR_FRAMEWORK_ERRORS[code]}`;
  return {
    instruction: index,
    program: programId ? programName(programId) : undefined,
    programId,
    code: `0x${code.toString(16)} (${code})`,
    meaning: known ?? anchor,
    hint:
      programId === SOLANA_PROGRAM_IDS.secp256k1 || programId === SOLANA_PROGRAM_IDS.ed25519
        ? SOLANA_DIAGNOSTIC_HINTS.precompileOffsets
        : undefined,
  };
};

/**
 * Detailed console report for a failed Solana send/simulation: decoded custom
 * program error, the program that raised it, full logs (via
 * SendTransactionError.getLogs), and the instruction list. Never throws.
 */
export const logSolanaTxFailure = async (
  context: string,
  err: unknown,
  conn: Connection,
  tx?: AnyTx
): Promise<void> => {
  try {
    const message = (err as Error)?.message ?? String(err);
    let logs: string[] | undefined = (err as { logs?: string[] })?.logs;
    const getLogs = (err as { getLogs?: (c: Connection) => Promise<string[]> })?.getLogs;
    if (typeof getLogs === 'function') {
      logs = await getLogs.call(err, conn).catch(() => logs);
    }
    console.error(`${LOG_PREFIX} ${context}: transaction failed.`, {
      message,
      decoded: decodeCustomError(tx, message),
      precompileProblems: tx ? findPrecompileOffsetProblems(tx) : undefined,
      logs,
      instructions: tx ? instructionTable(tx) : undefined,
      error: err,
    });
  } catch {
    console.error(`${LOG_PREFIX} ${context}: transaction failed.`, err);
  }
};

export const logSolanaWarning = (context: string, detail: unknown) => {
  console.warn(`${LOG_PREFIX} ${context}`, detail);
};
