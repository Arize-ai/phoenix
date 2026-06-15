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
 * Builds a stable string signature of just the time-range-related search
 * params ({@link TIME_RANGE_KEY_PARAM}, {@link TIME_RANGE_START_PARAM},
 * {@link TIME_RANGE_END_PARAM}), ignoring all other params in the URL.
 *
 * The params are collected in a fixed order so the resulting string is
 * deterministic regardless of how they happen to be ordered in the URL. This
 * lets callers cheaply compare whether the time range encoded in the URL has
 * changed (e.g. against `lastWrittenTimeRangeSearchRef`) without reacting to
 * unrelated search param updates.
 *
 * @param searchParams - The current URL search params.
 * @returns A normalized query string containing only the present time-range
 *   params, or an empty string if none are set.
 */
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

/**
 * Provides the active tracing time range to the app and keeps it in sync with
 * the URL.
 *
 * The active range takes one of two shapes:
 * - **Live (last-N):** a relative window like "7d" that always ends at "now"
 *   and refreshes on a timer (see {@link LastNTimeRangeKey}).
 * - **Custom:** a fixed, closed window with concrete start/end bounds.
 *
 * State is sourced with the following precedence:
 * 1. The URL search params — the canonical, shareable source of truth.
 * 2. The user's stored last-N preference — used when the URL carries no time
 *    range (e.g. a fresh visit).
 *
 * The subtle part is telling a *live* last-N range that we wrote ourselves
 * (which should keep tracking "now") apart from a *shared or restored* URL that
 * pins concrete bounds (which must be honored verbatim). Two refs disambiguate:
 * - `liveTimeRangeKeyRef`: the last-N key currently ticking live, or null.
 * - `lastWrittenTimeRangeSearchRef`: a signature of the time-range params we
 *   last wrote, so a URL matching it is known to be ours rather than external.
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
  // The last-N key currently tracking "now" live, or null when the active range
  // is a fixed custom window.
  const liveTimeRangeKeyRef = useRef<LastNTimeRangeKey | null>(null);
  // Signature of the time-range params we last wrote, used to recognize our own
  // URL writes versus an externally supplied (shared/restored) range.
  const lastWrittenTimeRangeSearchRef = useRef<string | null>(null);

  const currentTimeRangeSearch = getTimeRangeSearchSignature(searchParams);
  const urlTimeRangeKey = searchParams.get(TIME_RANGE_KEY_PARAM);
  const hasUrlTimeRangeBounds =
    searchParams.has(TIME_RANGE_START_PARAM) ||
    searchParams.has(TIME_RANGE_END_PARAM);

  // The URL range is "live" only when it is a last-N key that we wrote and have
  // been ticking — i.e. its params still match our last write. We then recompute
  // the window from the key rather than honoring any now-stale bounds in the URL.
  const isLiveUrlTimeRange =
    isLastNTimeRangeKey(urlTimeRangeKey) &&
    liveTimeRangeKeyRef.current === urlTimeRangeKey &&
    lastWrittenTimeRangeSearchRef.current === currentTimeRangeSearch;

  // A shared/restored URL keeps its concrete bounds; a live one re-derives them
  // from the key against `timeRangeNow`.
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
  // The URL wins when it carries a usable range; otherwise fall back to the
  // stored preference.
  const timeRange = urlTimeRange ?? storedTimeRange;
  const timeRangeStartMs = timeRange.start?.getTime();

  // A relative URL range is a last-N key with no concrete bounds pinned.
  const isRelativeUrlTimeRange =
    isLastNTimeRangeKey(urlTimeRangeKey) && !hasUrlTimeRangeBounds;
  // Whether the active range should keep ticking live against "now": a last-N
  // key that we are already tracking, that came from a relative URL, or that
  // came from the stored preference (no URL range at all).
  const isLiveLastNTimeRange =
    isLastNTimeRangeKey(timeRange.timeRangeKey) &&
    (liveTimeRangeKeyRef.current === timeRange.timeRangeKey ||
      isRelativeUrlTimeRange ||
      urlTimeRange == null);

  /**
   * Set the active time range and reflect it in the URL.
   *
   * Last-N keys are resolved to a concrete window at call time (anchored to
   * "now") and marked live so they keep refreshing; custom ranges are written
   * as-is. The URL write replaces history (no new entry per change) and any
   * last-N key is persisted as the user's preference.
   */
  const setTimeRange = (timeRange: OpenTimeRangeWithKey) => {
    const now = Date.now();
    const nextTimeRange = isLastNTimeRangeKey(timeRange.timeRangeKey)
      ? {
          timeRangeKey: timeRange.timeRangeKey,
          ...getTimeRangeFromLastNTimeRangeKey(timeRange.timeRangeKey, now),
        }
      : timeRange;
    // Track (last-N) or clear (custom) the live key so the URL sync can tell
    // this write apart from an externally supplied range.
    liveTimeRangeKeyRef.current = isLastNTimeRangeKey(timeRange.timeRangeKey)
      ? timeRange.timeRangeKey
      : null;
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
      // Persist the preset and re-anchor "now" so the live window refreshes.
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

  // Keep the URL in sync with the active range. This covers the cases that
  // `setTimeRange` does not write directly: seeding a fresh URL from the stored
  // preference on first load, and advancing a live window's end on each refresh.
  // The write is skipped when the params already match to avoid redundant
  // history updates.
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

  // Drive live refreshes. While a last-N range is live, schedule a bump of
  // `timeRangeNow` for when its window next rolls over (the start of the next
  // minute or hour) so the displayed window keeps tracking "now".
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
