import type { PropsWithChildren } from "react";
import { createContext, startTransition, useContext, useState } from "react";

import { useNullableTimeRangeContext } from "@phoenix/components/datetime/TimeRangeContext";
import { useInterval } from "@phoenix/hooks/useInterval";

import { usePreferencesContext } from "./PreferencesContext";

/** The longest the aggregates (charts, totals, summaries) wait for new data. */
export const DEFAULT_MAX_AGGREGATES_AGE_MS = 60_000;

export type SetFetchKeyParams = {
  /** The new fetch key. */
  fetchKey: string;
  /**
   * Leaves `throttledFetchKey` behind, to follow at the provider's next
   * interval. For the stream's own advance; a user action refreshes both.
   * @default false
   */
  isThrottled?: boolean;
};

export type StreamStateContextType = {
  /**
   * Whether or not streaming is enabled.
   * @default true
   */
  isStreaming: boolean;
  /**
   * Enables or disables streaming. Disabling it brings a `throttledFetchKey`
   * left behind up to `fetchKey`, since the interval stops.
   */
  setIsStreaming: (isStreaming: boolean) => void;
  /**
   * The fetch key for the current data.
   * E.g. this acts as a unique identifier for the data
   * It can be the count of traces or a hash of the data
   */
  fetchKey: string;
  /**
   * `fetchKey` as of the aggregates' last refresh. A server-side cache of the
   * aggregates would let them refetch on `fetchKey` and remove this key.
   */
  throttledFetchKey: string;
  /**
   * Sets the fetchKey to force a refetch. Unless throttled, it also moves
   * `throttledFetchKey` and a live time range's "now".
   */
  setFetchKey: (params: SetFetchKeyParams) => void;
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
 * Provides the stream's fetch keys. While streaming, it moves a
 * `throttledFetchKey` left behind up to `fetchKey` every
 * `maxAggregatesAgeMs`, together with a live time range's "now".
 *
 * @param props - the provider's props
 * @param props.initialFetchKey - both keys until the first change
 * @param props.maxAggregatesAgeMs - the longest `throttledFetchKey` stays
 * behind `fetchKey` while the tab is visible
 */
export function StreamStateProvider({
  initialFetchKey = "initial",
  maxAggregatesAgeMs = DEFAULT_MAX_AGGREGATES_AGE_MS,
  children,
}: PropsWithChildren<{
  initialFetchKey?: string;
  maxAggregatesAgeMs?: number;
}>) {
  const isStreaming = usePreferencesContext(
    (state) => state.traceStreamingEnabled
  );
  const setTraceStreamingEnabled = usePreferencesContext(
    (state) => state.setTraceStreamingEnabled
  );
  const refreshLiveTimeRange =
    useNullableTimeRangeContext()?.refreshLiveTimeRange;
  const [fetchKeys, setFetchKeys] = useState({
    fetchKey: initialFetchKey,
    throttledFetchKey: initialFetchKey,
  });

  const isThrottledFetchKeyBehind =
    fetchKeys.throttledFetchKey !== fetchKeys.fetchKey;
  // A live range's "now" moves with the aggregates' key, so their range has
  // one anchor.
  const catchUpThrottledFetchKey = () => {
    startTransition(() => {
      refreshLiveTimeRange?.();
      setFetchKeys((keys) => ({ ...keys, throttledFetchKey: keys.fetchKey }));
    });
  };
  const setFetchKey = ({
    fetchKey,
    isThrottled = false,
  }: SetFetchKeyParams) => {
    startTransition(() => {
      if (!isThrottled) {
        refreshLiveTimeRange?.();
      }
      setFetchKeys((keys) => ({
        fetchKey,
        throttledFetchKey: isThrottled ? keys.throttledFetchKey : fetchKey,
      }));
    });
  };
  const setIsStreaming = (nextIsStreaming: boolean) => {
    setTraceStreamingEnabled(nextIsStreaming);
    if (!nextIsStreaming && isThrottledFetchKeyBehind) {
      catchUpThrottledFetchKey();
    }
  };
  useInterval(
    () => {
      if (isThrottledFetchKeyBehind) {
        catchUpThrottledFetchKey();
      }
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
