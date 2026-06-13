import React, {
  createContext,
  startTransition,
  useEffect,
  useEffectEvent,
  useState,
} from "react";

import {
  SET_TIME_RANGE_TOOL_NAME,
  type SetTimeRangeInput,
} from "@phoenix/agent/tools/timeRange";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import type { OpenTimeRangeWithKey } from "./types";
import {
  getMillisecondsUntilNextLastNTimeRangeRefresh,
  getTimeRangeFromLastNTimeRangeKey,
  isLastNTimeRangeKey,
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

export function TimeRangeProvider({ children }: { children: React.ReactNode }) {
  /**
   * Load in the last N time range key from preferences
   */
  const storedLastNTimeRangeKey = usePreferencesContext(
    (state) => state.lastNTimeRangeKey
  );

  const setStoredLastNTimeRangeKey = usePreferencesContext(
    (state) => state.setLastNTimeRangeKey
  );

  // Default to the last N time range stored in preferences
  const [timeRange, _setTimeRange] = useState<OpenTimeRangeWithKey>(() => {
    // Just to be safe, we check if the stored time range key is valid
    if (isLastNTimeRangeKey(storedLastNTimeRangeKey)) {
      return {
        timeRangeKey: storedLastNTimeRangeKey,
        ...getTimeRangeFromLastNTimeRangeKey(storedLastNTimeRangeKey),
      };
    } else {
      // Fall back to the default time range
      return {
        timeRangeKey: "7d",
        ...getTimeRangeFromLastNTimeRangeKey("7d"),
      };
    }
  });

  const setTimeRange = (timeRange: OpenTimeRangeWithKey) => {
    const nextTimeRange = isLastNTimeRangeKey(timeRange.timeRangeKey)
      ? {
          timeRangeKey: timeRange.timeRangeKey,
          ...getTimeRangeFromLastNTimeRangeKey(timeRange.timeRangeKey),
        }
      : timeRange;
    startTransition(() => {
      _setTimeRange(nextTimeRange);
      // Store the last N time range key in preferences
      if (isLastNTimeRangeKey(timeRange.timeRangeKey)) {
        setStoredLastNTimeRangeKey(timeRange.timeRangeKey);
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
    if (!isLastNTimeRangeKey(timeRange.timeRangeKey)) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      _setTimeRange((currentTimeRange) => {
        if (!isLastNTimeRangeKey(currentTimeRange.timeRangeKey)) {
          return currentTimeRange;
        }
        return {
          timeRangeKey: currentTimeRange.timeRangeKey,
          ...getTimeRangeFromLastNTimeRangeKey(currentTimeRange.timeRangeKey),
        };
      });
    }, getMillisecondsUntilNextLastNTimeRangeRefresh(timeRange.timeRangeKey));
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [timeRange]);

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
