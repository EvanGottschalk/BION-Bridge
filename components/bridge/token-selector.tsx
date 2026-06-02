'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Search } from 'lucide-react';
import { getActiveChain, type ActiveChainKey } from '@/config/active_chains';
import {
  getFeaturedTokens,
  getTokenList,
  type TokenInfo,
} from '@/config/token_info';
import {
  RELAY_TOKEN_SEARCH_DEBOUNCE_MS,
  RELAY_TOKEN_SEARCH_LIMIT,
} from '@/config/relay_config';
import { relayApi } from '@/lib/relay/client';
import type { RelayCurrency } from '@/lib/relay/types';

interface TokenSelectorProps {
  label: string;
  chain: ActiveChainKey;
  selected: TokenInfo | null;
  onSelect: (token: TokenInfo) => void;
}

const TokenRow = ({
  token,
  active,
  onClick,
}: {
  token: TokenInfo;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
      active ? 'bg-primary/10 text-primary' : 'hover:bg-white/5 text-foreground'
    }`}
  >
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-semibold uppercase shrink-0">
        {token.symbol.slice(0, 3)}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-medium leading-tight truncate">{token.symbol}</span>
        <span className="text-xs text-muted-foreground leading-tight truncate">
          {token.name}
        </span>
      </div>
    </div>
    <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">
      {token.decimals ?? '?'} dec
    </span>
  </button>
);

const relayCurrencyToToken = (c: RelayCurrency): TokenInfo => ({
  symbol: c.symbol,
  name: c.name,
  address: c.address,
  decimals: c.decimals,
});

export function TokenSelector({ label, chain, selected, onSelect }: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const featured = useMemo(() => getFeaturedTokens(chain), [chain]);
  const full = useMemo(() => getTokenList(chain), [chain]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    if (!open) return;
    setRemote([]);
    if (!query || query.length < 2) return;
    const ac = new AbortController();
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await relayApi.searchCurrencies(
          {
            term: query,
            chainIds: [getActiveChain(chain).relayChainId],
            limit: RELAY_TOKEN_SEARCH_LIMIT,
            useExternalSearch: true,
          },
          ac.signal
        );
        setRemote(results.map(relayCurrencyToToken));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, RELAY_TOKEN_SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(id);
      ac.abort();
    };
  }, [query, chain, open]);

  const localMatches = useMemo(() => {
    if (!query) return full;
    const q = query.toLowerCase();
    return full.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase() === q
    );
  }, [full, query]);

  const mergedRemote = useMemo(() => {
    if (!remote.length) return [];
    const localAddrs = new Set(full.map((t) => t.address.toLowerCase()));
    return remote.filter((t) => !localAddrs.has(t.address.toLowerCase()));
  }, [remote, full]);

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 bg-[#0c0e1e] rounded-lg px-4 py-3 border border-white/15 hover:border-white/30 transition-all duration-200 cursor-pointer"
        >
          {selected ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-semibold uppercase shrink-0">
                {selected.symbol.slice(0, 3)}
              </div>
              <div className="flex flex-col min-w-0 text-left">
                <span className="font-medium leading-tight text-foreground truncate">
                  {selected.symbol}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight truncate">
                  {selected.name}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">Select token</span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#0c0e1e] rounded-lg z-50 border border-white/15 shadow-xl shadow-black/40 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-3 border-b border-white/10">
              <div className="flex items-center gap-2 bg-white/5 rounded-md px-3 py-2">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search symbol, name, or address"
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                />
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {!query && featured.length > 0 && (
                <>
                  <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Featured
                  </div>
                  {featured.map((t) => (
                    <TokenRow
                      key={`f-${t.address}-${t.symbol}`}
                      token={t}
                      active={selected?.address === t.address}
                      onClick={() => {
                        onSelect(t);
                        setOpen(false);
                      }}
                    />
                  ))}
                  <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    All tokens
                  </div>
                </>
              )}

              {localMatches.map((t) => (
                <TokenRow
                  key={`l-${t.address}-${t.symbol}`}
                  token={t}
                  active={selected?.address === t.address}
                  onClick={() => {
                    onSelect(t);
                    setOpen(false);
                  }}
                />
              ))}

              {mergedRemote.length > 0 && (
                <>
                  <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    From Relay
                  </div>
                  {mergedRemote.map((t) => (
                    <TokenRow
                      key={`r-${t.address}-${t.symbol}`}
                      token={t}
                      active={selected?.address === t.address}
                      onClick={() => {
                        onSelect(t);
                        setOpen(false);
                      }}
                    />
                  ))}
                </>
              )}

              {localMatches.length === 0 && mergedRemote.length === 0 && !loading && (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No tokens found.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
