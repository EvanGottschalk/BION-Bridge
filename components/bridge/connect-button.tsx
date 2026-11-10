'use client';

import { useCallback, useRef, useState } from 'react';
import { ConnectButton as RainbowConnectButton } from '@rainbow-me/rainbowkit';
import { useDisconnect } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Loader2 } from 'lucide-react';
import { ChainIcon } from './chain-icons';
import { WalletAccountModal } from './wallet-account-modal';
import {
  getActiveChain,
  getActiveChainByRelayId,
  type ActiveChain,
  type ActiveChainKey,
} from '@/config/active_chains';
import { ICON_SIZES_PX } from '@/config/ui_config';
import { useActiveChains } from '@/lib/network/network-mode';

const firstOfVm = (chains: ActiveChain[], vm: ActiveChain['vmType']): ActiveChain =>
  chains.find((c) => c.vmType === vm) ?? chains[0];

const shorten = (addr: string): string =>
  addr.length <= 12 ? addr : `${addr.slice(0, 5)}…${addr.slice(-4)}`;

function SolanaConnectPill() {
  const wallet = useWallet();
  const modal = useWalletModal();
  const [accountOpen, setAccountOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const closeAccount = useCallback(() => setAccountOpen(false), []);
  const solanaChain = firstOfVm(useActiveChains(), 'svm'); // devnet while Test Mode is ON
  const solanaChainKey = solanaChain.key;

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
      <div ref={anchorRef} className="sm:relative">
        <button
          type="button"
          onClick={() => setAccountOpen((v) => !v)}
          aria-expanded={accountOpen}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium glass-panel text-primary border border-primary/30 hover:border-primary/60 transition-colors cursor-pointer"
        >
          <ChainIcon chain={solanaChain} size={ICON_SIZES_PX.walletChain} />
          <span className="hidden sm:inline">{shorten(address)}</span>
        </button>
        <WalletAccountModal
          open={accountOpen}
          address={address}
          chainKey={solanaChainKey}
          anchorRef={anchorRef}
          onClose={closeAccount}
          onDisconnect={() => wallet.disconnect().catch(() => {})}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => modal.setVisible(true)}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium glass-button text-white hover:shadow-[0_0_25px_rgba(74,108,247,0.25)] transition-shadow cursor-pointer"
    >
      <ChainIcon chain={solanaChain} size={ICON_SIZES_PX.walletChain} />
      <span className="hidden sm:inline">Connect Solana</span>
    </button>
  );
}

function evmChainKey(chainId: number | undefined, fallback: ActiveChainKey): ActiveChainKey {
  if (chainId === undefined) return fallback;
  return getActiveChainByRelayId(chainId)?.key ?? fallback;
}

function EvmConnectPill() {
  const [accountOpen, setAccountOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const closeAccount = useCallback(() => setAccountOpen(false), []);
  const { disconnectAsync } = useDisconnect();
  const chains = useActiveChains();
  const fallbackEvmChain = firstOfVm(chains, 'evm');
  const fallbackEvm = fallbackEvmChain.key;
  // wagmi knows all four EVM chains; "wrong network" means outside this mode's set.
  const isModeChain = (id: number) => chains.some((c) => c.vmType === 'evm' && c.relayChainId === id);

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
              <ChainIcon chain={fallbackEvmChain} size={ICON_SIZES_PX.walletChain} />
              <span className="hidden sm:inline">Connect EVM</span>
            </button>
          );
        }
        if (chain.unsupported || !isModeChain(chain.id)) {
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
          <div ref={anchorRef} className="sm:relative">
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              aria-expanded={accountOpen}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium glass-panel text-primary border border-primary/30 hover:border-primary/60 transition-colors cursor-pointer"
            >
              <ChainIcon
                chain={getActiveChain(evmChainKey(chain.id, fallbackEvm))}
                size={ICON_SIZES_PX.walletChain}
              />
              <span className="hidden sm:inline">{shorten(account.address)}</span>
            </button>
            <WalletAccountModal
              open={accountOpen}
              address={account.address}
              chainKey={evmChainKey(chain.id, fallbackEvm)}
              anchorRef={anchorRef}
              onClose={closeAccount}
              onDisconnect={() => disconnectAsync().catch(() => {})}
            />
          </div>
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
