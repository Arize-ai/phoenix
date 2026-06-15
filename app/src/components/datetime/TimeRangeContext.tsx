import React, {
  createContext,
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router";

import {
  SET_TIME_RANGE_TOOL_NAME,
  type SetTimeRangeInput,
} from "@phoenix/agent/tools/timeRange";
import {
  TIME_RANGE_END_PARAM,
  TIME_RANGE_KEY_PARAM,
  TIME_RANGE_START_PARAM,
} from "@phoenix/constants/searchParams";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import type { LastNTimeRangeKey, OpenTimeRangeWithKey } from "./types";
import {
  getMillisecondsUntilNextLastNTimeRangeRefresh,
  getTimeRangeFromSearchParams,
  getTimeRangeFromLastNTimeRangeKey,
  isLastNTimeRangeKey,
  setTimeRangeSearchParams,
} from "./utils";

export type TimeRangeContextType = {
  timeRange: OpenTimeRangeWithKey;
  /**
   * Set the time range with the state write wrapped in a transition so
   * steering interactions (preset picks, pan/zoom) do not block the input
   * event.
   */
  setTimeRange: (timeRange: OpenTimeRangeWithKey) => void;
  /**
   * Apply a closed time range as a custom selection. Wraps the state write in
   * a transition so brush-driven updates do not block the input event.
   */
  setCustomTimeRange: (timeRange: TimeRange) => void;
};

export const TimeRangeContext = createContext<TimeRangeContextType | null>(
  null
);

export function useNullableTimeRangeContext() {
  return React.useContext(TimeRangeContext);
}

export function useTimeRange() {
  const context = useNullableTimeRangeContext();
  if (context === null) {
    throw new Error(
      "useTimeRange must be used within a TimeRangeContextProvider"
    );
  }
  return context;
}

function getStoredTimeRange({
  storedLastNTimeRangeKey,
  now,
}: {
  storedLastNTimeRangeKey: unknown;
  now: number;
}): OpenTimeRangeWithKey {
  // Just to be safe, we check if the stored time range key is valid
  if (isLastNTimeRangeKey(storedLastNTimeRangeKey)) {
    return {
      timeRangeKey: storedLastNTimeRangeKey,
      ...getTimeRangeFromLastNTimeRangeKey(storedLastNTimeRangeKey, now),
    };
  }
  // Fall back to the default time range
  return {
    timeRangeKey: "7d",
    ...getTimeRangeFromLastNTimeRangeKey("7d", now),
  };
}

function getTimeRangeSearchSignature(searchParams: URLSearchParams) {
  const scopedSearchParams = new URLSearchParams();
  for (const param of [
    TIME_RANGE_KEY_PARAM,
    TIME_RANGE_START_PARAM,
    TIME_RANGE_END_PARAM,
  ]) {
    const value = searchParams.get(param);
    if (value != null) {
      scopedSearchParams.set(param, value);
    }
  }
  return scopedSearchParams.toString();
}

export function TimeRangeProvider({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  /**
   * Load in the last N time range key from preferences
   */
  const storedLastNTimeRangeKey = usePreferencesContext(
    (state) => state.lastNTimeRangeKey
  );

  const setStoredLastNTimeRangeKey = usePreferencesContext(
    (state) => state.setLastNTimeRangeKey
  );

  const [timeRangeNow, setTimeRangeNow] = useState(() => Date.now());
  const liveTimeRangeKeyRef = useRef<LastNTimeRangeKey | null>(null);
  const lastWrittenTimeRangeSearchRef = useRef<string | null>(null);
  const currentTimeRangeSearch = getTimeRangeSearchSignature(searchParams);
  const urlTimeRangeKey = searchParams.get(TIME_RANGE_KEY_PARAM);
  const hasUrlTimeRangeBounds =
    searchParams.has(TIME_RANGE_START_PARAM) ||
    searchParams.has(TIME_RANGE_END_PARAM);
  const isLiveUrlTimeRange =
    isLastNTimeRangeKey(urlTimeRangeKey) &&
    liveTimeRangeKeyRef.current === urlTimeRangeKey &&
    lastWrittenTimeRangeSearchRef.current === currentTimeRangeSearch;
  const urlTimeRange = getTimeRangeFromSearchParams(
    searchParams,
    timeRangeNow,
    {
      preferConcreteBounds: !isLiveUrlTimeRange,
    }
  );
  const storedTimeRange = getStoredTimeRange({
    storedLastNTimeRangeKey,
    now: timeRangeNow,
  });
  const timeRange = urlTimeRange ?? storedTimeRange;
  const timeRangeStartMs = timeRange.start?.getTime();
  const isRelativeUrlTimeRange =
    isLastNTimeRangeKey(urlTimeRangeKey) && !hasUrlTimeRangeBounds;
  const isLiveLastNTimeRange =
    isLastNTimeRangeKey(timeRange.timeRangeKey) &&
    (liveTimeRangeKeyRef.current === timeRange.timeRangeKey ||
      isRelativeUrlTimeRange ||
      urlTimeRange == null);

  const setTimeRange = (timeRange: OpenTimeRangeWithKey) => {
    const now = Date.now();
    const nextTimeRange = isLastNTimeRangeKey(timeRange.timeRangeKey)
      ? {
          timeRangeKey: timeRange.timeRangeKey,
          ...getTimeRangeFromLastNTimeRangeKey(timeRange.timeRangeKey, now),
        }
      : timeRange;
    if (isLastNTimeRangeKey(timeRange.timeRangeKey)) {
      liveTimeRangeKeyRef.current = timeRange.timeRangeKey;
    } else {
      liveTimeRangeKeyRef.current = null;
    }
    startTransition(() => {
      setSearchParams(
        (currentSearchParams) => {
          const nextSearchParams = setTimeRangeSearchParams({
            searchParams: currentSearchParams,
            timeRange: nextTimeRange,
            now: new Date(now),
          });
          lastWrittenTimeRangeSearchRef.current =
            getTimeRangeSearchSignature(nextSearchParams);
          return nextSearchParams;
        },
        { replace: true }
      );
      // Store the last N time range key in preferences
      if (isLastNTimeRangeKey(timeRange.timeRangeKey)) {
        setStoredLastNTimeRangeKey(timeRange.timeRangeKey);
        setTimeRangeNow(now);
      }
    });
  };

  const setCustomTimeRange = (timeRange: TimeRange) => {
    setTimeRange({
      timeRangeKey: "custom",
      start: timeRange.start,
      end: timeRange.end,
    });
  };

  useEffect(() => {
    if (isLiveLastNTimeRange) {
      liveTimeRangeKeyRef.current = timeRange.timeRangeKey as LastNTimeRangeKey;
    }
    const nextSearchParams = setTimeRangeSearchParams({
      searchParams,
      timeRange,
      now: new Date(timeRangeNow),
    });
    if (nextSearchParams.toString() === searchParams.toString()) {
      return;
    }
    lastWrittenTimeRangeSearchRef.current =
      getTimeRangeSearchSignature(nextSearchParams);
    setSearchParams(nextSearchParams, { replace: true });
  }, [
    isLiveLastNTimeRange,
    searchParams,
    setSearchParams,
    timeRange,
    timeRangeNow,
  ]);

  useEffect(() => {
    if (!isLiveLastNTimeRange || !isLastNTimeRangeKey(timeRange.timeRangeKey)) {
      return;
    }
    const timeRangeKey = timeRange.timeRangeKey;
    const timeoutId = window.setTimeout(() => {
      setTimeRangeNow(Date.now());
    }, getMillisecondsUntilNextLastNTimeRangeRefresh(timeRangeKey));
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isLiveLastNTimeRange, timeRange.timeRangeKey, timeRangeStartMs]);

  useRegisterSetTimeRangeClientAction({ setTimeRange });

  return (
    <TimeRangeContext.Provider
      value={{
        timeRange,
        setTimeRange,
        setCustomTimeRange,
      }}
    >
      {children}
    </TimeRangeContext.Provider>
  );
}

/**
 * Parse an optional tool-supplied datetime into the Date shape used by the
 * shared time range context.
 */
function parseOptionalDateTime(value: string | undefined): Date | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO datetime: ${value}`);
  }
  return date;
}

/**
 * Register the browser-side implementation of PXI's `set_time_range` tool
 * while a time range provider is mounted.
 */
function useRegisterSetTimeRangeClientAction({
  setTimeRange,
}: {
  setTimeRange: (timeRange: OpenTimeRangeWithKey) => void;
}) {
  const agentStore = useAgentStore();

  const handleSetTimeRange = useEffectEvent(
    async (input: SetTimeRangeInput): Promise<AgentClientActionResult> => {
      if (input.timeRangeKey !== "custom") {
        // Presets are recomputed at execution time so relative windows are
        // anchored to the user's current browser time.
        setTimeRange({
          timeRangeKey: input.timeRangeKey,
          ...getTimeRangeFromLastNTimeRangeKey(input.timeRangeKey),
        });
        return { ok: true, output: `Set time range to ${input.timeRangeKey}.` };
      }

      try {
        // Custom ranges can be bounded on either side, matching OpenTimeRange.
        const start = parseOptionalDateTime(input.startTime);
        const end = parseOptionalDateTime(input.endTime);
        if (start === undefined && end === undefined) {
          return {
            ok: false,
            error:
              "Custom time range requires at least one of startTime or endTime.",
          };
        }
        if (start !== undefined && end !== undefined && start > end) {
          return {
            ok: false,
            error: "Custom time range startTime must be before endTime.",
          };
        }
        setTimeRange({ timeRangeKey: "custom", start, end });
        const startText = start?.toISOString() ?? "open start";
        const endText = end?.toISOString() ?? "open end";
        return {
          ok: true,
          output: `Set custom time range from ${startText} to ${endText}.`,
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Invalid time range.",
        };
      }
    }
  );

  useEffect(() => {
    const { registerClientAction, unregisterClientAction } =
      agentStore.getState();
    registerClientAction(SET_TIME_RANGE_TOOL_NAME, (input) =>
      handleSetTimeRange(input as SetTimeRangeInput)
    );
    return () => {
      unregisterClientAction(SET_TIME_RANGE_TOOL_NAME);
    };
  }, [agentStore]);
}
