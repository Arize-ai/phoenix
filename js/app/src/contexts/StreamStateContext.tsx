import type { PropsWithChildren } from "react";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useState,
} from "react";

import { useInterval } from "@phoenix/hooks/useInterval";

import { usePreferencesContext } from "./PreferencesContext";
import { INITIAL_FETCH_KEY } from "./streamFetchKeys";

/** The longest the aggregates (charts, totals, summaries) wait for new data. */
export const DEFAULT_MAX_AGGREGATES_AGE_MS = 60_000;

export type StreamStateContextType = {
  /**
   * Whether or not streaming is enabled.
   * @default true
   */
  isStreaming: boolean;
  /**
   * Enables or disables streaming.
   */
  setIsStreaming: (isStreaming: boolean) => void;
  /**
   * The fetch key for the current data.
   * E.g. this acts as a unique identifier for the data
   * It can be the count of traces or a hash of the data
   */
  fetchKey: string;
  /**
   * `fetchKey` as of the aggregates' last refresh, which follows it at most
   * every `maxAggregatesAgeMs`. A server-side cache of the aggregates would
   * let them refetch on `fetchKey` and remove this key.
   */
  throttledFetchKey: string;
  /** When `throttledFetchKey` last changed, in epoch milliseconds. */
  throttledAt: number;
  /**
   * Sets the fetchKey to force a refetch
   */
  setFetchKey: (fetchKey: string) => void;
};

export const StreamStateContext = createContext<StreamStateContextType | null>(
  null
);

export function useStreamState() {
  const context = useContext(StreamStateContext);
  if (context === null) {
    throw new Error("useStreamState must be used within a StreamStateProvider");
  }
  return context;
}

/**
 * Provides the stream's fetch keys.
 *
 * @param props - the provider's props
 * @param props.initialFetchKey - both keys until the first change
 * @param props.maxAggregatesAgeMs - the longest `throttledFetchKey` stays
 * behind `fetchKey` while the tab is visible
 */
export function StreamStateProvider({
  initialFetchKey = INITIAL_FETCH_KEY,
  maxAggregatesAgeMs = DEFAULT_MAX_AGGREGATES_AGE_MS,
  children,
}: PropsWithChildren<{
  initialFetchKey?: string;
  maxAggregatesAgeMs?: number;
}>) {
  const isStreaming = usePreferencesContext(
    (state) => state.traceStreamingEnabled
  );
  const setIsStreaming = usePreferencesContext(
    (state) => state.setTraceStreamingEnabled
  );
  const [fetchKeys, setFetchKeys] = useState(() => ({
    fetchKey: initialFetchKey,
    throttledFetchKey: initialFetchKey,
    throttledAt: Date.now(),
  }));

  const setFetchKey = useCallback((fetchKey: string) => {
    startTransition(() => {
      setFetchKeys((keys) => ({ ...keys, fetchKey }));
    });
  }, []);
  // `useInterval` pauses while the tab is hidden and ticks once it is shown.
  useInterval(
    () => {
      const now = Date.now();
      startTransition(() => {
        setFetchKeys((keys) =>
          keys.throttledFetchKey === keys.fetchKey
            ? keys
            : { ...keys, throttledFetchKey: keys.fetchKey, throttledAt: now }
        );
      });
    },
    isStreaming ? maxAggregatesAgeMs : null
  );
  return (
    <StreamStateContext.Provider
      value={{ isStreaming, setIsStreaming, ...fetchKeys, setFetchKey }}
    >
      {children}
    </StreamStateContext.Provider>
  );
}
