'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ActiveChain, ActiveChainKey } from '@/config/active_chains';
import { ChainIcon } from './chain-icons';

interface ChainSelectorProps {
  label: string;
  chains: ActiveChain[]; // the current mode's chains (useActiveChains)
  selectedChain: ActiveChainKey;
  onSelect: (chainKey: ActiveChainKey) => void;
  excludeChain?: ActiveChainKey;
  // When set, only these chains can be picked (e.g. an NTT token's deployment).
  allowedChains?: ActiveChainKey[];
}

export function ChainSelector({
  label,
  chains,
  selectedChain,
  onSelect,
  excludeChain,
  allowedChains,
}: ChainSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = chains.find((c) => c.key === selectedChain) ?? chains[0];

  return (
    <div className="flex flex-col gap-2" ref={ref}>
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-3 bg-[#0c0e1e] rounded-lg px-4 py-3 border border-white/15 hover:border-white/30 transition-all duration-200 cursor-pointer group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <ChainIcon chainKey={selected.iconKey} />
            <span className="text-foreground font-medium truncate">{selected.displayName}</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#0c0e1e] rounded-lg overflow-hidden z-50 border border-white/15 shadow-xl shadow-black/40 animate-in fade-in slide-in-from-top-2 duration-200">
            {chains.map((chain) => {
              const isExcluded =
                chain.key === excludeChain ||
                (allowedChains !== undefined && !allowedChains.includes(chain.key));
              return (
                <button
                  key={chain.key}
                  type="button"
                  onClick={() => {
                    if (!isExcluded) {
                      onSelect(chain.key);
                      setOpen(false);
                    }
                  }}
                  disabled={isExcluded}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 transition-colors cursor-pointer ${
                    isExcluded
                      ? 'opacity-40 cursor-not-allowed'
                      : chain.key === selectedChain
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-white/5 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ChainIcon chainKey={chain.iconKey} />
                    <span className="font-medium truncate">{chain.displayName}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
