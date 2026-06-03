'use client';

import { useState } from 'react';
import { ConnectButton as RainbowConnectButton } from '@rainbow-me/rainbowkit';
import { useDisconnect } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Loader2 } from 'lucide-react';
import { EthereumIcon, SolanaIcon } from './chain-icons';
import { WalletAccountModal } from './wallet-account-modal';
import { getActiveChainByRelayId, type ActiveChainKey } from '@/config/active_chains';

const shorten = (addr: string): string =>
  addr.length <= 12 ? addr : `${addr.slice(0, 5)}…${addr.slice(-4)}`;

function SolanaConnectPill() {
  const wallet = useWallet();
  const modal = useWalletModal();
  const [accountOpen, setAccountOpen] = useState(false);

  if (wallet.connecting) {
    return (
      <button
        type="button"
        disabled
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium glass-panel text-foreground"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="hidden sm:inline">Connecting…</span>
      </button>
    );
  }

  if (wallet.connected && wallet.publicKey) {
    const address = wallet.publicKey.toBase58();
    return (
      <>
        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium glass-panel text-primary border border-primary/30 hover:border-primary/60 transition-colors cursor-pointer"
        >
          <SolanaIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{shorten(address)}</span>
        </button>
        <WalletAccountModal
          open={accountOpen}
          address={address}
          chainKey="solana"
          onClose={() => setAccountOpen(false)}
          onDisconnect={() => wallet.disconnect().catch(() => {})}
        />
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={() => modal.setVisible(true)}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium glass-button text-white hover:shadow-[0_0_25px_rgba(74,108,247,0.25)] transition-shadow cursor-pointer"
    >
      <SolanaIcon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Connect Solana</span>
    </button>
  );
}

function evmChainKey(chainId: number | undefined): ActiveChainKey {
  if (chainId === undefined) return 'ethereum';
  return getActiveChainByRelayId(chainId)?.key ?? 'ethereum';
}

function EvmConnectPill() {
  const [accountOpen, setAccountOpen] = useState(false);
  const { disconnectAsync } = useDisconnect();

  return (
    <RainbowConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, mounted }) => {
        if (!mounted) return null;
        if (!account || !chain) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium glass-button text-white hover:shadow-[0_0_25px_rgba(74,108,247,0.25)] transition-shadow cursor-pointer"
            >
              <EthereumIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Connect EVM</span>
            </button>
          );
        }
        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-300 border border-red-400/40 hover:border-red-400 transition-colors cursor-pointer"
            >
              <span className="hidden sm:inline">Wrong network</span>
              <span className="sm:hidden">!</span>
            </button>
          );
        }
        return (
          <>
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium glass-panel text-primary border border-primary/30 hover:border-primary/60 transition-colors cursor-pointer"
            >
              <EthereumIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{shorten(account.address)}</span>
            </button>
            <WalletAccountModal
              open={accountOpen}
              address={account.address}
              chainKey={evmChainKey(chain.id)}
              onClose={() => setAccountOpen(false)}
              onDisconnect={() => disconnectAsync().catch(() => {})}
            />
          </>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}

export function ConnectButton() {
  return (
    <div className="flex items-center gap-2">
      <EvmConnectPill />
      <SolanaConnectPill />
    </div>
  );
}
