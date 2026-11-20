import 'server-only';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { parseUnits } from 'viem';
import { resolveRpcUrls } from '@/config/chain_info';
import {
  FAUCET_CONFIRM_TIMEOUT_MS,
  FAUCET_ENV,
  FAUCET_NATIVE,
  FAUCET_SOLANA_CHAIN,
  FAUCET_SOLANA_RPC_URLS,
  faucetExplorerTxUrl,
  type FaucetToken,
} from '@/config/faucet_config';
import { readEnv } from './env';
import { FaucetSendError, toSendError } from './errors';

const COMMITMENT = 'confirmed';

export function parseSolanaRecipient(raw: string): PublicKey | null {
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

function createContext() {
  const raw = readEnv(FAUCET_ENV.solanaSecretKey);
  if (!raw) throw new FaucetSendError('not_configured', `${FAUCET_ENV.solanaSecretKey} is missing`);
  let payer: Keypair;
  try {
    payer = Keypair.fromSecretKey(raw.startsWith('[') ? Uint8Array.from(JSON.parse(raw)) : bs58.decode(raw));
  } catch {
    throw new FaucetSendError('not_configured', `${FAUCET_ENV.solanaSecretKey} is not a valid secret key`);
  }
  const [rpcUrl] = resolveRpcUrls(FAUCET_SOLANA_RPC_URLS);
  if (!rpcUrl) throw new FaucetSendError('not_configured', 'No Solana RPC URL');
  return { payer, connection: new Connection(rpcUrl, COMMITMENT) };
}

let context: ReturnType<typeof createContext> | null = null;

export async function sendSolana(token: FaucetToken, recipient: PublicKey) {
  context ??= createContext();
  const { payer, connection } = context;
  const amount = parseUnits(token.amount, token.decimals);

  let signature: string;
  let blockhash: string;
  let lastValidBlockHeight: number;
  try {
    const tx = new Transaction();
    if (token.address === FAUCET_NATIVE) {
      tx.add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: recipient, lamports: amount }));
    } else {
      const mint = new PublicKey(token.address);
      const mintAccount = await connection.getAccountInfo(mint);
      if (!mintAccount) throw new FaucetSendError('send_failed', `Mint ${token.address} not found`);
      const programId = mintAccount.owner; // classic SPL Token or Token-2022
      const source = getAssociatedTokenAddressSync(mint, payer.publicKey, false, programId);
      const destination = getAssociatedTokenAddressSync(mint, recipient, true, programId);
      // The faucet pays rent for the recipient's token account if they don't have one yet.
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, destination, recipient, mint, programId),
        await createTransferCheckedWithTransferHookInstruction(
          connection,
          source,
          mint,
          destination,
          payer.publicKey,
          amount,
          token.decimals,
          [],
          COMMITMENT,
          programId
        )
      );
    }
    ({ blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(COMMITMENT));
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    tx.sign(payer);
    // Preflight simulation rejects it here (before broadcast) if the faucet is short.
    signature = await connection.sendRawTransaction(tx.serialize());
  } catch (error) {
    throw toSendError(error); // nothing was broadcast
  }

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), FAUCET_CONFIRM_TIMEOUT_MS));
  try {
    const result = await Promise.race([
      connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, COMMITMENT),
      timeout,
    ]);
    if (result?.value.err) {
      throw new FaucetSendError('send_failed', `Failed on-chain: ${JSON.stringify(result.value.err)}`);
    }
    if (!result) console.warn('[faucet] Solana confirmation not seen in time', signature);
  } catch (error) {
    if (error instanceof FaucetSendError) throw error;
    console.warn('[faucet] Solana confirmation check failed', signature, error);
  }

  return { txHash: signature, explorerUrl: faucetExplorerTxUrl(FAUCET_SOLANA_CHAIN, signature) };
}
