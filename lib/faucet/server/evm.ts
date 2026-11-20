import 'server-only';
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  fallback,
  getAddress,
  http,
  isAddress,
  nonceManager,
  parseUnits,
  type Address,
  type Chain,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as viemChains from 'viem/chains';
import { resolveRpcUrls } from '@/config/chain_info';
import {
  FAUCET_CONFIRM_TIMEOUT_MS,
  FAUCET_ENV,
  FAUCET_EVM_CHAIN,
  FAUCET_NATIVE,
  faucetExplorerTxUrl,
  type FaucetToken,
} from '@/config/faucet_config';
import { readEnv } from './env';
import { FaucetSendError, toSendError } from './errors';

export function parseEvmRecipient(raw: string): Address | null {
  return isAddress(raw, { strict: false }) ? getAddress(raw) : null;
}

function createClients() {
  const rawKey = readEnv(FAUCET_ENV.evmPrivateKey);
  if (!rawKey) throw new FaucetSendError('not_configured', `${FAUCET_ENV.evmPrivateKey} is missing`);
  const chain = (Object.values(viemChains) as Chain[]).find((c) => c.id === FAUCET_EVM_CHAIN.chainId);
  if (!chain) throw new FaucetSendError('not_configured', `Unknown EVM chain ${FAUCET_EVM_CHAIN.chainId}`);
  const transport = fallback(resolveRpcUrls(FAUCET_EVM_CHAIN.rpcUrls).map((url) => http(url)));
  // nonceManager keeps nonces in order when claims overlap on one server instance.
  const account = privateKeyToAccount((rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as Hex, {
    nonceManager,
  });
  return {
    account,
    chain,
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ account, chain, transport }),
  };
}

let clients: ReturnType<typeof createClients> | null = null;

export async function sendEvm(token: FaucetToken, recipient: Address) {
  clients ??= createClients();
  const { account, chain, publicClient, walletClient } = clients;
  const value = parseUnits(token.amount, token.decimals);

  let hash: Hex;
  try {
    hash =
      token.address === FAUCET_NATIVE
        ? await walletClient.sendTransaction({ account, chain, to: recipient, value })
        : await walletClient.writeContract({
            account,
            chain,
            address: token.address as Address,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [recipient, value],
          });
  } catch (error) {
    throw toSendError(error); // nothing was broadcast
  }

  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: FAUCET_CONFIRM_TIMEOUT_MS });
    if (receipt.status === 'reverted') throw new FaucetSendError('send_failed', `Reverted: ${hash}`);
  } catch (error) {
    if (error instanceof FaucetSendError) throw error;
    // Timed out or RPC hiccup: it was broadcast, so report success and keep the cooldown.
    console.warn('[faucet] EVM confirmation not seen in time', hash, error);
  }

  return { txHash: hash, explorerUrl: faucetExplorerTxUrl(FAUCET_EVM_CHAIN, hash) };
}
