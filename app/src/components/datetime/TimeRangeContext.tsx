import React, {
  createContext,
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "react-router";

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
  getTimeRangeFromSearchParams,
  getTimeRangeFromLastNTimeRangeKey,
  isLastNTimeRangeKey,
  setTimeRangeSearchParams,
} from "./utils";

export type TimeRangeContextType = {
  timeRange: OpenTimeRangeWithKey;
  timeRangeISOStrings: TimeRangeISOStrings;
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

/** ISO 8601 bounds for the active time range. */
export type TimeRangeISOStrings = {
  start: string | undefined;
  end: string | undefined;
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

/**
 * Resolve the time range to fall back to when the URL carries none, from the
 * user's stored last-N preference. Defaults to the last 7 days when the stored
 * value is missing or invalid.
 */
function getStoredTimeRange({
  storedLastNTimeRangeKey,
  now,
}: {
  storedLastNTimeRangeKey: unknown;
  now: number;
}): OpenTimeRangeWithKey {
  // Guard against a malformed stored value before trusting it.
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

/**
 * Provides the active tracing time range to the app and keeps it in sync with
 * the URL.
 *
 * The active range takes one of two shapes, mirroring the URL's two mutually
 * exclusive representations (see {@link getTimeRangeFromSearchParams}):
 * - **Live (last-N):** a `timeRangeKey` like "7d" with no bounds. It always
 *   ends at "now" and refreshes on a timer (see {@link LastNTimeRangeKey}).
 * - **Custom:** explicit start/end bounds with no key — a fixed window honored
 *   verbatim.
 *
 * Because the URL is declarative — a key XOR explicit bounds — "is this range
 * live?" is a pure function of its shape: a last-N key is always live, a custom
 * range never is. No provenance tracking is needed to tell a self-authored URL
 * apart from a shared/restored one.
 *
 * State is sourced with the following precedence:
 * 1. The URL search params — the canonical, shareable source of truth.
 * 2. The user's stored last-N preference — used when the URL carries no time
 *    range (e.g. a fresh visit), and then seeded into the URL.
 */
export function TimeRangeProvider({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const storedLastNTimeRangeKey = usePreferencesContext(
    (state) => state.lastNTimeRangeKey
  );
  const setStoredLastNTimeRangeKey = usePreferencesContext(
    (state) => state.setLastNTimeRangeKey
  );

  // The "now" anchor for resolving relative (last-N) windows. Bumped on a timer
  // so live windows slide forward, and reset whenever a new last-N range is set.
  const [timeRangeNow, setTimeRangeNow] = useState(() => Date.now());

  // The URL wins when it carries a usable range; otherwise fall back to the
  // stored preference (computed lazily, only when the URL carries no range).
  const urlTimeRange = getTimeRangeFromSearchParams(searchParams, timeRangeNow);
  const timeRange =
    urlTimeRange ??
    getStoredTimeRange({ storedLastNTimeRangeKey, now: timeRangeNow });
  const timeRangeStartMs = timeRange.start?.getTime();
  const start = timeRange.start?.toISOString();
  const end = timeRange.end?.toISOString();
  const timeRangeISOStrings = useMemo(() => ({ start, end }), [start, end]);

  /**
   * Set the active time range and reflect it in the URL.
   *
   * The URL write is declarative: a last-N key is written as just the key
   * (clearing any bounds) and a custom range as just its bounds. The write
   * replaces history (no new entry per change) and any last-N key is persisted
   * as the user's preference.
   */
  const setTimeRange = (timeRange: OpenTimeRangeWithKey) => {
    startTransition(() => {
      setSearchParams(
        (currentSearchParams) =>
          setTimeRangeSearchParams({
            searchParams: currentSearchParams,
            timeRange,
          }),
        { replace: true }
      );
      // Persist the preset and re-anchor "now" so the live window refreshes.
      if (isLastNTimeRangeKey(timeRange.timeRangeKey)) {
        setStoredLastNTimeRangeKey(timeRange.timeRangeKey);
        setTimeRangeNow(Date.now());
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

  // Seed a fresh URL from the stored preference on first load. Once the URL
  // carries a range it is canonical, so this no-ops. A live window's refresh
  // needs no URL write: the URL holds only the key, and the window is
  // recomputed from `timeRangeNow` on each render.
  useEffect(() => {
    if (urlTimeRange != null) {
      return;
    }
    const nextSearchParams = setTimeRangeSearchParams({
      searchParams,
      timeRange,
    });
    if (nextSearchParams.toString() === searchParams.toString()) {
      return;
    }
    setSearchParams(nextSearchParams, { replace: true });
  }, [urlTimeRange, searchParams, setSearchParams, timeRange]);

  // Drive live refreshes. While a last-N range is live, schedule a bump of
  // `timeRangeNow` for when its window next rolls over (the start of the next
  // minute or hour) so the displayed window keeps tracking "now".
  useEffect(() => {
    if (!isLastNTimeRangeKey(timeRange.timeRangeKey)) {
      return;
    }
    const timeRangeKey = timeRange.timeRangeKey;
    const timeoutId = window.setTimeout(() => {
      setTimeRangeNow(Date.now());
    }, getMillisecondsUntilNextLastNTimeRangeRefresh(timeRangeKey));
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [timeRange.timeRangeKey, timeRangeStartMs]);

  useRegisterSetTimeRangeClientAction({ setTimeRange });

  return (
    <TimeRangeContext.Provider
      value={{
        timeRange,
        timeRangeISOStrings,
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
