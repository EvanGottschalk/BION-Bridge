'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { TEST_MODE_DEFAULT, TEST_MODE_STORAGE_KEY } from '@/config/blockchain_config';
import { TEST_MODE_TOGGLE_VISIBLE } from '@/config/ui_config';
import { getChainsForMode, type ActiveChain } from '@/config/active_chains';

type NetworkModeValue = {
  testMode: boolean;
  setTestMode: (next: boolean) => void;
  toggleVisible: boolean;
};

const NetworkModeContext = createContext<NetworkModeValue>({
  testMode: TEST_MODE_DEFAULT,
  setTestMode: () => {},
  toggleVisible: TEST_MODE_TOGGLE_VISIBLE,
});

const readStored = (): boolean | null => {
  try {
    const v = window.localStorage.getItem(TEST_MODE_STORAGE_KEY);
    if (v === 'true') return true;
    if (v === 'false') return false;
    return null;
  } catch {
    return null;
  }
};

const writeStored = (value: boolean) => {
  try {
    window.localStorage.setItem(TEST_MODE_STORAGE_KEY, String(value));
  } catch {
    // Storage blocked (private window, disabled site data) — the choice just
    // won't survive a reload.
  }
};

export function NetworkModeProvider({ children }: { children: ReactNode }) {
  // SSR and the first client render always use the default so markup matches;
  // the stored choice is applied right after mount.
  const [testMode, setTestModeState] = useState<boolean>(
    TEST_MODE_TOGGLE_VISIBLE ? TEST_MODE_DEFAULT : false
  );

  useEffect(() => {
    if (!TEST_MODE_TOGGLE_VISIBLE) return; // hidden toggle ⇒ always mainnet
    const stored = readStored();
    if (stored !== null) setTestModeState(stored);
  }, []);

  const setTestMode = useCallback((next: boolean) => {
    if (!TEST_MODE_TOGGLE_VISIBLE) return;
    setTestModeState(next);
    writeStored(next);
  }, []);

  const value = useMemo(
    () => ({ testMode, setTestMode, toggleVisible: TEST_MODE_TOGGLE_VISIBLE }),
    [testMode, setTestMode]
  );

  return <NetworkModeContext.Provider value={value}>{children}</NetworkModeContext.Provider>;
}

export const useNetworkMode = (): NetworkModeValue => useContext(NetworkModeContext);

/** Chains offered in the UI for the current mode. */
export const useActiveChains = (): ActiveChain[] => {
  const { testMode } = useNetworkMode();
  return useMemo(() => getChainsForMode(testMode), [testMode]);
};
