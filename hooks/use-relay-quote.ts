'use client';

import { useEffect, useRef, useState } from 'react';
import {
  RELAY_QUOTE_DEBOUNCE_MS,
  RELAY_QUOTE_REFRESH_MS,
} from '@/config/relay_config';
import { relayApi, RelayApiError } from '@/lib/relay/client';
import { buildQuoteRequest, parseQuote, type BuildQuoteArgs, type ParsedQuote } from '@/lib/relay/quote';

export type QuoteState =
  | { kind: 'idle' }
  | { kind: 'loading'; previous?: ParsedQuote }
  | { kind: 'ready'; quote: ParsedQuote; fetchedAt: number }
  | { kind: 'error'; message: string; previous?: ParsedQuote };

export type UseRelayQuoteArgs = Partial<BuildQuoteArgs> & {
  enabled?: boolean;
};

const argsReady = (a: UseRelayQuoteArgs): a is BuildQuoteArgs & { enabled?: boolean } => {
  if (!a.user || !a.fromChain || !a.toChain || !a.fromToken || !a.toToken) return false;
  if (!a.amount || Number(a.amount) <= 0) return false;
  if (a.fromChain === a.toChain && a.fromToken.address === a.toToken.address) return false;
  return true;
};

export const useRelayQuote = (args: UseRelayQuoteArgs): QuoteState => {
  const [state, setState] = useState<QuoteState>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const lastKey = useRef<string>('');

  const enabled = args.enabled !== false && argsReady(args);

  useEffect(() => {
    if (!enabled) {
      setState({ kind: 'idle' });
      return;
    }
    const key = JSON.stringify({
      user: args.user,
      from: args.fromChain,
      to: args.toChain,
      ft: args.fromToken?.address,
      tt: args.toToken?.address,
      amt: args.amount,
      rcp: args.recipient,
    });
    if (key === lastKey.current && state.kind === 'ready') return;
    lastKey.current = key;

    const ac = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ac;

    setState((prev) =>
      prev.kind === 'ready'
        ? { kind: 'loading', previous: prev.quote }
        : prev.kind === 'error' && prev.previous
          ? { kind: 'loading', previous: prev.previous }
          : { kind: 'loading' }
    );

    const debounce = setTimeout(async () => {
      try {
        const req = buildQuoteRequest(args as BuildQuoteArgs);
        const resp = await relayApi.getQuote(req, ac.signal);
        if (ac.signal.aborted) return;
        const parsed = parseQuote(resp);
        setState({ kind: 'ready', quote: parsed, fetchedAt: Date.now() });
      } catch (err) {
        if (ac.signal.aborted) return;
        const message =
          err instanceof RelayApiError
            ? `Relay API ${err.status}: ${err.body || err.message}`
            : (err as Error).message || 'Unknown quote error';
        setState((prev) => ({
          kind: 'error',
          message,
          previous: prev.kind === 'ready' ? prev.quote : undefined,
        }));
      }
    }, RELAY_QUOTE_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounce);
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    args.user,
    args.fromChain,
    args.toChain,
    args.fromToken?.address,
    args.toToken?.address,
    args.amount,
    args.recipient,
  ]);

  const fetchedAt = state.kind === 'ready' ? state.fetchedAt : 0;
  useEffect(() => {
    if (!fetchedAt) return;
    const id = setTimeout(() => {
      lastKey.current = '';
      setState((prev) =>
        prev.kind === 'ready' ? { kind: 'loading', previous: prev.quote } : prev
      );
    }, RELAY_QUOTE_REFRESH_MS);
    return () => clearTimeout(id);
  }, [fetchedAt]);

  return state;
};
