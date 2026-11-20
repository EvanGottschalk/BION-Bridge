import { createPublicClient, erc20Abi, fallback, http, type Address, type PublicClient } from 'viem';
import { Connection, PublicKey } from '@solana/web3.js';
import { resolveRpcUrls } from '@/config/chain_info';
import {
  FAUCET_BALANCE_FORMAT,
  FAUCET_EVM_CHAIN,
  FAUCET_NATIVE,
  FAUCET_SOLANA_RPC_URLS,
  type FaucetToken,
} from '@/config/faucet_config';

// Reads a wallet's balance of a faucet token, in base units. Used once when
// the token / wallet changes; after a claim the page adds the claimed amount
// itself instead of re-reading the chain.

let evmClient: PublicClient | null = null;
let solanaConnection: Connection | null = null;

function getEvmClient() {
  evmClient ??= createPublicClient({
    transport: fallback(resolveRpcUrls(FAUCET_EVM_CHAIN.rpcUrls).map((url) => http(url))),
  });
  return evmClient;
}

function getSolanaConnection() {
  const [url] = resolveRpcUrls(FAUCET_SOLANA_RPC_URLS);
  solanaConnection ??= new Connection(url, 'confirmed');
  return solanaConnection;
}

export async function fetchFaucetBalance(token: FaucetToken, owner: string): Promise<bigint> {
  if (token.vm === 'evm') {
    const client = getEvmClient();
    return token.address === FAUCET_NATIVE
      ? client.getBalance({ address: owner as Address })
      : client.readContract({
          address: token.address as Address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [owner as Address],
        });
  }

  const connection = getSolanaConnection();
  const ownerKey = new PublicKey(owner);
  if (token.address === FAUCET_NATIVE) return BigInt(await connection.getBalance(ownerKey));
  const { value } = await connection.getParsedTokenAccountsByOwner(ownerKey, {
    mint: new PublicKey(token.address),
  });
  return value.reduce((sum, account) => sum + BigInt(account.account.data.parsed.info.tokenAmount.amount), BigInt(0));
}

const formatter = new Intl.NumberFormat(FAUCET_BALANCE_FORMAT.locale, {
  maximumFractionDigits: FAUCET_BALANCE_FORMAT.maxFractionDigits,
});

export const formatFaucetBalance = (value: number) => formatter.format(value);
