import { fromDate } from "@internationalized/date";
import {
  startOfHour,
  startOfMinute,
  subDays,
  subHours,
  subMinutes,
} from "date-fns";
import type { DateValue } from "react-aria-components";

import {
  TIME_RANGE_END_PARAM,
  TIME_RANGE_KEY_PARAM,
  TIME_RANGE_START_PARAM,
} from "@phoenix/constants/searchParams";
import { assertUnreachable } from "@phoenix/typeUtils";

import { LAST_N_TIME_RANGES_MAP } from "./constants";
import type {
  LastNTimeRangeKey,
  LastNTimeRangeUnit,
  OpenTimeRangeWithKey,
  TimeRangeKey,
} from "./types";

const MINUTE_IN_MS = 60 * 1000;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;
const DAY_IN_MS = 24 * HOUR_IN_MS;

const LAST_N_TIME_RANGE_KEY_REGEX = /^(\d+)([mhd])$/;

type ParsedLastNTimeRange = {
  quantity: number;
  unit: LastNTimeRangeUnit;
};

function parseLastNTimeRangeKey(key: unknown): ParsedLastNTimeRange | null {
  if (typeof key !== "string") {
    return null;
  }
  const match = LAST_N_TIME_RANGE_KEY_REGEX.exec(key);
  if (!match) {
    return null;
  }
  const quantity = parseInt(match[1], 10);
  if (quantity < 1) {
    return null;
  }
  return { quantity, unit: match[2] as LastNTimeRangeUnit };
}

function getLastNTimeRangeDurationMs({
  quantity,
  unit,
}: ParsedLastNTimeRange): number {
  switch (unit) {
    case "m":
      return quantity * MINUTE_IN_MS;
    case "h":
      return quantity * HOUR_IN_MS;
    case "d":
      return quantity * DAY_IN_MS;
    default:
      return assertUnreachable(unit);
  }
}

export function getTimeRangeFromLastNTimeRangeKey(
  key: LastNTimeRangeKey,
  now = Date.now()
): OpenTimeRange {
  const parsed = parseLastNTimeRangeKey(key);
  if (!parsed) {
    throw new Error(`Invalid last N time range key: ${key}`);
  }
  const { quantity, unit } = parsed;
  let start: Date;
  switch (unit) {
    case "m":
      start = subMinutes(now, quantity);
      break;
    case "h":
      start = subHours(now, quantity);
      break;
    case "d":
      start = subDays(now, quantity);
      break;
    default:
      assertUnreachable(unit);
  }
  // Windows up to an hour snap to the minute so the range tracks closely;
  // anything longer snaps to the hour.
  const snap =
    getLastNTimeRangeDurationMs(parsed) <= HOUR_IN_MS
      ? startOfMinute
      : startOfHour;
  return { start: snap(start), end: null };
}

export function getMillisecondsUntilNextLastNTimeRangeRefresh(
  key: LastNTimeRangeKey
): number {
  const parsed = parseLastNTimeRangeKey(key);
  const interval =
    parsed && getLastNTimeRangeDurationMs(parsed) <= HOUR_IN_MS
      ? MINUTE_IN_MS
      : HOUR_IN_MS;
  const elapsed = Date.now() % interval;
  return elapsed === 0 ? interval : interval - elapsed;
}

/**
 * Type guard for the last N time range key
 */
export function isLastNTimeRangeKey(key: unknown): key is LastNTimeRangeKey {
  return parseLastNTimeRangeKey(key) !== null;
}
/**
 * Type guard for the time range key
 */
export function isTimeRangeKey(key: unknown): key is TimeRangeKey {
  return isLastNTimeRangeKey(key) || key === "custom";
}

function getDateFromSearchParamValue(value: string | null) {
  if (value == null || value.trim() === "") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Parses a selected time range from URL search params.
 *
 * The URL encodes exactly one representation of the range (see
 * {@link setTimeRangeSearchParams}):
 * - a preset key ({@link TIME_RANGE_KEY_PARAM}), which is always live and
 *   re-resolves against `now`, owning no bounds; or
 * - an explicit (custom) range defined purely by its
 *   {@link TIME_RANGE_START_PARAM}/{@link TIME_RANGE_END_PARAM} bounds.
 *
 * A preset key therefore always wins — bounds are only consulted when no preset
 * key is present, which also means a legacy URL carrying both is read as a live
 * preset. Invalid or incomplete params return null so callers can fall back to
 * the user's stored preference.
 */
export function getTimeRangeFromSearchParams(
  searchParams: URLSearchParams,
  now = Date.now()
): OpenTimeRangeWithKey | null {
  const urlTimeRangeKey = searchParams.get(TIME_RANGE_KEY_PARAM);
  if (isLastNTimeRangeKey(urlTimeRangeKey)) {
    return {
      timeRangeKey: urlTimeRangeKey,
      ...getTimeRangeFromLastNTimeRangeKey(urlTimeRangeKey, now),
    };
  }
  const start = getDateFromSearchParamValue(
    searchParams.get(TIME_RANGE_START_PARAM)
  );
  const end = getDateFromSearchParamValue(
    searchParams.get(TIME_RANGE_END_PARAM)
  );
  // Non-parseable bounds, no bounds at all, or an inverted window are unusable.
  if (start === undefined || end === undefined) {
    return null;
  }
  if (start == null && end == null) {
    return null;
  }
  if (start != null && end != null && start > end) {
    return null;
  }
  return {
    timeRangeKey: "custom",
    start,
    end,
  };
}

/**
 * Writes the selected time range to URL search params while preserving
 * unrelated params such as selected span/session state.
 *
 * Exactly one representation is written and the other is cleared, so the URL is
 * never ambiguous (see {@link getTimeRangeFromSearchParams}): a preset key is
 * live and carries no bounds; a custom range is defined solely by its bounds.
 */
export function setTimeRangeSearchParams({
  searchParams,
  timeRange,
}: {
  searchParams: URLSearchParams;
  timeRange: OpenTimeRangeWithKey;
}): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  const setOrDelete = (param: string, value: Date | null | undefined) => {
    if (value != null) {
      nextSearchParams.set(param, value.toISOString());
    } else {
      nextSearchParams.delete(param);
    }
  };
  if (isLastNTimeRangeKey(timeRange.timeRangeKey)) {
    nextSearchParams.set(TIME_RANGE_KEY_PARAM, timeRange.timeRangeKey);
    nextSearchParams.delete(TIME_RANGE_START_PARAM);
    nextSearchParams.delete(TIME_RANGE_END_PARAM);
    return nextSearchParams;
  }
  nextSearchParams.delete(TIME_RANGE_KEY_PARAM);
  setOrDelete(TIME_RANGE_START_PARAM, timeRange.start);
  setOrDelete(TIME_RANGE_END_PARAM, timeRange.end);
  return nextSearchParams;
}

const LAST_N_UNIT_LABELS: Record<
  LastNTimeRangeUnit,
  { singular: string; plural: string }
> = {
  m: { singular: "minute", plural: "minutes" },
  h: { singular: "hour", plural: "hours" },
  d: { singular: "day", plural: "days" },
};

/**
 * Human-readable label for a last N time range key. Presets keep their curated
 * labels (e.g. "Last 15 Min"); arbitrary keys are spelled out (e.g. "25m" →
 * "Last 25 minutes").
 */
export function getLastNTimeRangeLabel(key: LastNTimeRangeKey): string {
  const preset = LAST_N_TIME_RANGES_MAP[key];
  if (preset) {
    return preset.label;
  }
  const parsed = parseLastNTimeRangeKey(key);
  if (!parsed) {
    return key;
  }
  const { quantity, unit } = parsed;
  const { singular, plural } = LAST_N_UNIT_LABELS[unit];
  return `Last ${quantity} ${quantity === 1 ? singular : plural}`;
}

const TIME_RANGE_SEARCH_REGEX =
  /^(?:last\s+)?(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/;

const TIME_RANGE_QUANTITY_SEARCH_REGEX = /^(?:last\s+)?(\d+)$/;

/**
 * Parse free-form search text like "25m", "25 min", or "last 2 hours" into a
 * last N time range key. Returns null when the text is not a duration.
 */
export function parseTimeRangeSearchText(
  text: string
): LastNTimeRangeKey | null {
  const match = TIME_RANGE_SEARCH_REGEX.exec(text.trim().toLowerCase());
  if (!match) {
    return null;
  }
  const quantity = parseInt(match[1], 10);
  if (quantity < 1) {
    return null;
  }
  const unit = match[2][0] as LastNTimeRangeUnit;
  return `${quantity}${unit}` as LastNTimeRangeKey;
}

/**
 * Last N time range keys suggested by free-form search text. A full duration
 * ("25m") suggests exactly that key; a bare quantity ("25") suggests it in
 * every unit; anything else suggests nothing.
 */
export function getTimeRangeSearchSuggestions(
  text: string
): LastNTimeRangeKey[] {
  const exactKey = parseTimeRangeSearchText(text);
  if (exactKey) {
    return [exactKey];
  }
  const match = TIME_RANGE_QUANTITY_SEARCH_REGEX.exec(
    text.trim().toLowerCase()
  );
  if (!match) {
    return [];
  }
  const quantity = parseInt(match[1], 10);
  if (quantity < 1) {
    return [];
  }
  return [`${quantity}m`, `${quantity}h`, `${quantity}d`];
}

/** Default fraction of the window a pan step shifts by. */
const DEFAULT_PAN_SHIFT_FRACTION = 0.5;
/** Default multiplier applied to the window duration when zooming. */
const DEFAULT_ZOOM_FACTOR = 2;
/** Default smallest window zooming in will produce. */
const DEFAULT_MIN_ZOOM_WINDOW_MS = MINUTE_IN_MS;

type PanTimeRangeParams = {
  value: OpenTimeRangeWithKey;
  /** Reference "now" for resolving open-ended ranges. Defaults to the current time. */
  now?: Date;
  /** Fraction of the window to shift by. */
  shiftFraction?: number;
};

type ZoomTimeRangeParams = {
  value: OpenTimeRangeWithKey;
  /** Reference "now" for resolving open-ended ranges. Defaults to the current time. */
  now?: Date;
  /** Multiplier applied to the window duration. */
  zoomFactor?: number;
  /** Smallest window zooming in will produce. */
  minWindowMs?: number;
};

/**
 * Resolve a (possibly open-ended) time range into a concrete window. An open
 * end resolves to `now`. A range with no start (or an inverted window) has no
 * duration to pan or zoom by, so it resolves to null.
 */
function getResolvedWindow({
  value,
  now,
}: {
  value: OpenTimeRange;
  now: Date;
}): { startMs: number; endMs: number; durationMs: number } | null {
  if (!value.start) {
    return null;
  }
  const startMs = value.start.getTime();
  const endMs = (value.end ?? now).getTime();
  const durationMs = endMs - startMs;
  if (durationMs <= 0) {
    return null;
  }
  return { startMs, endMs, durationMs };
}

/**
 * The last-N key matching the given duration, expressed in the largest
 * readable unit (e.g. 90 minutes → "90m", 120 minutes → "2h", 48 hours →
 * "2d"). Once a duration spans at least two of a unit it is rounded to that
 * unit ("85d", not "2048h") — repeated zooming rarely lands on exact
 * multiples, so windows would otherwise stay in small units forever. Below
 * that, only exact multiples switch units. Durations are rounded to the
 * nearest minute, with a one minute floor.
 */
function getLastNTimeRangeKeyFromDurationMs(ms: number): LastNTimeRangeKey {
  const minutes = Math.max(1, Math.round(ms / MINUTE_IN_MS));
  const days = minutes / (24 * 60);
  if (days >= 2 || Number.isInteger(days)) {
    return `${Math.round(days)}d`;
  }
  const hours = minutes / 60;
  if (hours >= 2 || Number.isInteger(hours)) {
    return `${Math.round(hours)}h`;
  }
  return `${minutes}m`;
}

/**
 * Shift the window back in time by `shiftFraction` of its duration (half by
 * default). Panning steps off the live edge, so the result is always a closed
 * custom range. Returns null when the range has no resolvable window.
 */
export function panTimeRangeLeft({
  value,
  now = new Date(),
  shiftFraction = DEFAULT_PAN_SHIFT_FRACTION,
}: PanTimeRangeParams): OpenTimeRangeWithKey | null {
  const window = getResolvedWindow({ value, now });
  if (!window) {
    return null;
  }
  const shiftMs = window.durationMs * shiftFraction;
  return {
    timeRangeKey: "custom",
    start: new Date(window.startMs - shiftMs),
    end: new Date(window.endMs - shiftMs),
  };
}

/**
 * Shift the window forward in time by `shiftFraction` of its duration (half by
 * default), clamped so it never extends past `now`. Returns null when the
 * range is already live (open-ended) or there is no room left to shift.
 */
export function panTimeRangeRight({
  value,
  now = new Date(),
  shiftFraction = DEFAULT_PAN_SHIFT_FRACTION,
}: PanTimeRangeParams): OpenTimeRangeWithKey | null {
  if (!value.end) {
    return null;
  }
  const window = getResolvedWindow({ value, now });
  if (!window) {
    return null;
  }
  const shiftMs = Math.min(
    window.durationMs * shiftFraction,
    now.getTime() - window.endMs
  );
  if (shiftMs <= 0) {
    return null;
  }
  return {
    timeRangeKey: "custom",
    start: new Date(window.startMs + shiftMs),
    end: new Date(window.endMs + shiftMs),
  };
}

/**
 * Narrow the window by `zoomFactor` (halving it by default), down to a
 * `minWindowMs` floor. Live (open-ended) ranges stay live and zoom toward
 * `now`, mapping to the equivalent last-N key; closed ranges zoom around their
 * center. Returns null when there is nothing to zoom.
 */
export function zoomTimeRangeIn({
  value,
  now = new Date(),
  zoomFactor = DEFAULT_ZOOM_FACTOR,
  minWindowMs = DEFAULT_MIN_ZOOM_WINDOW_MS,
}: ZoomTimeRangeParams): OpenTimeRangeWithKey | null {
  return zoomTimeRange({ value, now, factor: 1 / zoomFactor, minWindowMs });
}

/**
 * Widen the window by `zoomFactor` (doubling it by default). Live (open-ended)
 * ranges stay live and zoom out from `now`, mapping to the equivalent last-N
 * key; closed ranges zoom around their center, sliding back any portion that
 * would extend past `now`. Returns null when there is nothing to zoom.
 */
export function zoomTimeRangeOut({
  value,
  now = new Date(),
  zoomFactor = DEFAULT_ZOOM_FACTOR,
  minWindowMs = DEFAULT_MIN_ZOOM_WINDOW_MS,
}: ZoomTimeRangeParams): OpenTimeRangeWithKey | null {
  return zoomTimeRange({ value, now, factor: zoomFactor, minWindowMs });
}

function zoomTimeRange({
  value,
  now,
  factor,
  minWindowMs,
}: {
  value: OpenTimeRangeWithKey;
  now: Date;
  factor: number;
  minWindowMs: number;
}): OpenTimeRangeWithKey | null {
  if (!value.end) {
    // Live (open-ended) ranges stay live and re-anchor to now. The duration
    // comes from the last-N key — its resolved start is snapped to the
    // minute/hour, so deriving the duration from the window would drift.
    const parsedKey = parseLastNTimeRangeKey(value.timeRangeKey);
    const liveDurationMs = parsedKey
      ? getLastNTimeRangeDurationMs(parsedKey)
      : getResolvedWindow({ value, now })?.durationMs;
    if (liveDurationMs == null) {
      return null;
    }
    const newDurationMs = Math.max(liveDurationMs * factor, minWindowMs);
    // Zooming in at (or below) the minimum window has nothing left to reveal.
    if (factor < 1 && newDurationMs >= liveDurationMs) {
      return null;
    }
    const timeRangeKey = getLastNTimeRangeKeyFromDurationMs(newDurationMs);
    if (timeRangeKey === value.timeRangeKey) {
      return null;
    }
    return {
      timeRangeKey,
      ...getTimeRangeFromLastNTimeRangeKey(timeRangeKey),
    };
  }

  // Closed (custom) ranges zoom around their center by the exact factor.
  const window = getResolvedWindow({ value, now });
  if (!window) {
    return null;
  }
  const newDurationMs = Math.max(window.durationMs * factor, minWindowMs);
  // Zooming in at (or below) the minimum window has nothing left to reveal.
  if (
    factor < 1
      ? newDurationMs >= window.durationMs
      : newDurationMs === window.durationMs
  ) {
    return null;
  }
  const centerMs = (window.startMs + window.endMs) / 2;
  let startMs = centerMs - newDurationMs / 2;
  let endMs = centerMs + newDurationMs / 2;
  const overflowMs = endMs - now.getTime();
  if (overflowMs > 0) {
    startMs -= overflowMs;
    endMs -= overflowMs;
  }
  return {
    timeRangeKey: "custom",
    start: new Date(startMs),
    end: new Date(endMs),
  };
}

/**
 * Converts a JS Date into a DateValue in the given time zone, for seeding
 * react-aria date components.
 */
export function toDateValue(
  date: Date | null | undefined,
  timeZone: string
): DateValue | null {
  return date ? fromDate(date, timeZone) : null;
}
