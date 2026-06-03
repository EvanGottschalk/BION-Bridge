'use client';

import { useEffect, useState } from 'react';
import { useBalance } from 'wagmi';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getActiveChain, type ActiveChainKey } from '@/config/active_chains';
import { NATIVE_EVM_ADDRESS, NATIVE_SOL_ADDRESS } from '@/config/relay_config';
import type { TokenInfo } from '@/config/token_info';
import { useWalletForChain } from '@/lib/wallets/use-active-wallet';

export type TokenBalanceState = {
  raw: bigint | null;
  formatted: string | null;
  loading: boolean;
};

export const formatTokenAmount = (
  raw: bigint,
  decimals: number,
  maxFrac = 4
): string => {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const denom = 10n ** BigInt(decimals);
  const whole = abs / denom;
  const frac = abs % denom;
  if (frac === 0n || decimals === 0) {
    return `${negative ? '-' : ''}${whole.toString()}`;
  }
  const padded = frac.toString().padStart(decimals, '0');
  const sliced = padded.slice(0, maxFrac);
  const trimmed = sliced.replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${trimmed ? `.${trimmed}` : ''}`;
};

export const useTokenBalance = (
  chain: ActiveChainKey,
  token: TokenInfo | null
): TokenBalanceState => {
  const wallet = useWalletForChain(chain);
  const meta = getActiveChain(chain);
  const isEvm = meta.vmType === 'evm';
  const isSvm = meta.vmType === 'svm';

  const isNativeEvm = isEvm && token?.address === NATIVE_EVM_ADDRESS;

  const evm = useBalance({
    address: isEvm ? (wallet.address as `0x${string}` | undefined) : undefined,
    chainId: isEvm ? meta.relayChainId : undefined,
    token: !isEvm || !token || isNativeEvm
      ? undefined
      : (token.address as `0x${string}`),
    query: {
      enabled: isEvm && Boolean(wallet.address) && Boolean(token),
      staleTime: 15_000,
    },
  });

  const { connection } = useConnection();
  const svmWallet = useWallet();
  const [svm, setSvm] = useState<{ raw: bigint | null; loading: boolean }>({
    raw: null,
    loading: false,
  });

  const svmPubkeyKey = svmWallet.publicKey?.toBase58();
  const tokenAddress = token?.address;

  useEffect(() => {
    if (!isSvm || !svmWallet.publicKey || !token) {
      setSvm({ raw: null, loading: false });
      return;
    }
    let cancelled = false;
    setSvm({ raw: null, loading: true });
    (async () => {
      try {
        if (token.address === NATIVE_SOL_ADDRESS) {
          const lamports = await connection.getBalance(svmWallet.publicKey!);
          if (!cancelled) setSvm({ raw: BigInt(lamports), loading: false });
          return;
        }
        const mint = new PublicKey(token.address);
        const accounts = await connection.getParsedTokenAccountsByOwner(
          svmWallet.publicKey!,
          { mint }
        );
        let total = 0n;
        for (const a of accounts.value) {
          const info = (a.account.data as { parsed?: { info?: { tokenAmount?: { amount?: string } } } })
            .parsed?.info?.tokenAmount?.amount;
          if (info) total += BigInt(info);
        }
        if (!cancelled) setSvm({ raw: total, loading: false });
      } catch {
        if (!cancelled) setSvm({ raw: 0n, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSvm, svmPubkeyKey, tokenAddress, connection, token, svmWallet.publicKey]);

  if (!token || !wallet.isConnected) {
    return { raw: null, formatted: null, loading: false };
  }

  if (isEvm) {
    const data = evm.data;
    const raw = data ? data.value : null;
    const decimals = token.decimals ?? data?.decimals ?? 18;
    return {
      raw,
      formatted: raw !== null ? formatTokenAmount(raw, decimals) : null,
      loading: evm.isLoading,
    };
  }

  if (isSvm) {
    const decimals = token.decimals ?? 0;
    return {
      raw: svm.raw,
      formatted: svm.raw !== null ? formatTokenAmount(svm.raw, decimals) : null,
      loading: svm.loading,
    };
  }

  return { raw: null, formatted: null, loading: false };
};
