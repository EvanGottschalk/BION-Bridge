'use client';

import { useEffect, useRef, useState } from 'react';
import { RelayApiError } from '@/lib/relay/client';
import { loadProvider, QUOTE_TIMINGS, selectProviderId } from '@/lib/bridge/router';
import {
  BridgeQuoteError,
  type BridgeProviderId,
  type BridgeQuoteState,
  type BridgeRoute,
} from '@/lib/bridge/types';
import { SWAP_PROGRESS_COPY } from '@/config/ui_config';

export type UseBridgeQuoteArgs = Partial<BridgeRoute> & { enabled?: boolean };

const argsReady = (a: UseBridgeQuoteArgs): a is BridgeRoute & { enabled?: boolean } => {
  if (!a.user || !a.fromChain || !a.toChain || !a.fromToken || !a.toToken) return false;
  if (!a.amount || Number(a.amount) <= 0) return false;
  if (a.fromChain === a.toChain && a.fromToken.address === a.toToken.address) return false;
  return true;
};

const errorMessage = (err: unknown): string => {
  if (err instanceof RelayApiError) return `Relay API ${err.status}: ${err.body || err.message}`;
  return (err as Error)?.message || SWAP_PROGRESS_COPY.unknownError;
};

/**
 * Debounced, auto-refreshing quote for whichever provider the router picks.
 * Same lifecycle the Relay-only hook had: abort superseded requests, keep the
 * previous quote visible while refreshing, refresh on a timer.
 */
export const useBridgeQuote = (
  args: UseBridgeQuoteArgs
): { state: BridgeQuoteState; providerId: BridgeProviderId } => {
  const [state, setState] = useState<BridgeQuoteState>({ kind: 'idle' });
  // Bumped by the refresh timer so the fetch effect re-runs with unchanged inputs.
  const [refreshTick, setRefreshTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastKey = useRef<string>('');

  const enabled = args.enabled !== false && argsReady(args);
  const providerId: BridgeProviderId =
    args.fromChain && args.toChain
      ? selectProviderId({
          fromChain: args.fromChain,
          toChain: args.toChain,
          fromToken: args.fromToken,
          toToken: args.toToken,
        })
      : 'relay';
  const timings = QUOTE_TIMINGS[providerId];

  useEffect(() => {
    if (!enabled) {
      lastKey.current = '';
      setState({ kind: 'idle' });
      return;
    }
    const key = JSON.stringify({
      p: providerId,
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

    const route = args as BridgeRoute;
    const debounce = setTimeout(async () => {
      try {
        const provider = await loadProvider(providerId);
        const quote = await provider.quote(route, ac.signal);
        if (ac.signal.aborted) return;
        setState({ kind: 'ready', quote, fetchedAt: Date.now() });
      } catch (err) {
        if (ac.signal.aborted) return;
        setState((prev) => ({
          kind: 'error',
          message: errorMessage(err),
          code: err instanceof BridgeQuoteError ? err.code : undefined,
          previous: prev.kind === 'ready' ? prev.quote : undefined,
        }));
      }
    }, timings.debounceMs);

    return () => {
      clearTimeout(debounce);
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    providerId,
    args.user,
    args.fromChain,
    args.toChain,
    args.fromToken?.address,
    args.toToken?.address,
    args.amount,
    args.recipient,
    refreshTick,
  ]);

  const fetchedAt = state.kind === 'ready' ? state.fetchedAt : 0;
  useEffect(() => {
    if (!fetchedAt) return;
    const id = setTimeout(() => {
      lastKey.current = '';
      setRefreshTick((t) => t + 1);
    }, timings.refreshMs);
    return () => clearTimeout(id);
  }, [fetchedAt, timings.refreshMs]);

  return { state, providerId };
};
