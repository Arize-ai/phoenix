import { fromDate } from "@internationalized/date";
import {
  startOfHour,
  startOfMinute,
  subDays,
  subHours,
  subMinutes,
} from "date-fns";
import type { DateValue } from "react-aria-components";

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
      assertUnreachable(unit);
  }
}

export function getTimeRangeFromLastNTimeRangeKey(
  key: LastNTimeRangeKey
): OpenTimeRange {
  const parsed = parseLastNTimeRangeKey(key);
  if (!parsed) {
    throw new Error(`Invalid last N time range key: ${key}`);
  }
  const now = Date.now();
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

const PAN_SHIFT_FRACTION = 0.5;
const ZOOM_FACTOR = 2;
/** The smallest window zooming in will produce. */
const MIN_ZOOM_WINDOW_MS = MINUTE_IN_MS;

/**
 * Human-friendly durations that zooming snaps to. This prevents awkward
 * values like 32m or 64m that arise from pure 2x multiplication.
 */
const EVEN_DURATIONS_MS = [
  1, // 1m
  2, // 2m
  5, // 5m
  10, // 10m
  15, // 15m
  30, // 30m
  45, // 45m
  60, // 1h
  90, // 1.5h
  120, // 2h
  180, // 3h
  240, // 4h
  360, // 6h
  480, // 8h
  720, // 12h
  1440, // 1d
  2880, // 2d
  4320, // 3d
  5760, // 4d
  7200, // 5d
  10080, // 7d
  14400, // 10d
  21600, // 15d
  43200, // 30d
  64800, // 45d
  86400, // 60d
  129600, // 90d
  259200, // 180d
  525600, // 365d
].map((m) => m * MINUTE_IN_MS);

/**
 * Snap a duration to the nearest value in EVEN_DURATIONS_MS. When
 * equidistant between two values, prefers the larger one.
 */
function snapToEvenDuration(ms: number): number {
  let closest = EVEN_DURATIONS_MS[0];
  let minDiff = Math.abs(ms - closest);
  for (const candidate of EVEN_DURATIONS_MS) {
    const diff = Math.abs(ms - candidate);
    // Use <= to prefer the larger value when equidistant.
    if (diff <= minDiff) {
      minDiff = diff;
      closest = candidate;
    }
  }
  return closest;
}

/**
 * Resolve a (possibly open-ended) time range into a concrete window. An open
 * end resolves to `now`. A range with no start (or an inverted window) has no
 * duration to pan or zoom by, so it resolves to null.
 */
function getResolvedWindow(
  value: OpenTimeRange,
  now: Date
): { startMs: number; endMs: number; durationMs: number } | null {
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
 * Shift the window back in time by half its duration. Panning steps off the
 * live edge, so the result is always a closed custom range. Returns null when
 * the range has no resolvable window.
 */
export function panTimeRangeLeft(
  value: OpenTimeRangeWithKey,
  now: Date = new Date()
): OpenTimeRangeWithKey | null {
  const window = getResolvedWindow(value, now);
  if (!window) {
    return null;
  }
  const shiftMs = window.durationMs * PAN_SHIFT_FRACTION;
  return {
    timeRangeKey: "custom",
    start: new Date(window.startMs - shiftMs),
    end: new Date(window.endMs - shiftMs),
  };
}

/**
 * Shift the window forward in time by half its duration, clamped so it never
 * extends past `now`. Returns null when the range is already live
 * (open-ended) or there is no room left to shift.
 */
export function panTimeRangeRight(
  value: OpenTimeRangeWithKey,
  now: Date = new Date()
): OpenTimeRangeWithKey | null {
  if (!value.end) {
    return null;
  }
  const window = getResolvedWindow(value, now);
  if (!window) {
    return null;
  }
  const shiftMs = Math.min(
    window.durationMs * PAN_SHIFT_FRACTION,
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
 * Halve the window duration, down to a one minute floor. Live (open-ended)
 * ranges stay live and zoom toward `now`, mapping to the equivalent last-N
 * key; closed ranges zoom around their center. Returns null when there is
 * nothing to zoom.
 */
export function zoomTimeRangeIn(
  value: OpenTimeRangeWithKey,
  now: Date = new Date()
): OpenTimeRangeWithKey | null {
  return zoomTimeRange(value, now, 1 / ZOOM_FACTOR);
}

/**
 * Double the window duration. Live (open-ended) ranges stay live and zoom
 * out from `now`, mapping to the equivalent last-N key; closed ranges zoom
 * around their center, sliding back any portion that would extend past `now`.
 * Returns null when there is nothing to zoom.
 */
export function zoomTimeRangeOut(
  value: OpenTimeRangeWithKey,
  now: Date = new Date()
): OpenTimeRangeWithKey | null {
  return zoomTimeRange(value, now, ZOOM_FACTOR);
}

function zoomTimeRange(
  value: OpenTimeRangeWithKey,
  now: Date,
  factor: number
): OpenTimeRangeWithKey | null {
  // For last-N presets the key is the duration's source of truth — the
  // resolved start is snapped to the minute/hour, so deriving the duration
  // from it would drift.
  const parsedKey = parseLastNTimeRangeKey(value.timeRangeKey);
  const window = getResolvedWindow(value, now);
  const durationMs = parsedKey
    ? getLastNTimeRangeDurationMs(parsedKey)
    : window?.durationMs;
  if (durationMs == null) {
    return null;
  }
  const rawDurationMs = Math.max(durationMs * factor, MIN_ZOOM_WINDOW_MS);
  const newDurationMs = snapToEvenDuration(rawDurationMs);
  // Zooming in at (or below) the minimum window has nothing left to reveal.
  if (newDurationMs === snapToEvenDuration(durationMs)) {
    return null;
  }
  if (!value.end) {
    // Live ranges stay live: re-anchor the new duration to now.
    const timeRangeKey = getLastNTimeRangeKeyFromDurationMs(newDurationMs);
    if (timeRangeKey === value.timeRangeKey) {
      return null;
    }
    return {
      timeRangeKey,
      ...getTimeRangeFromLastNTimeRangeKey(timeRangeKey),
    };
  }
  if (!window) {
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
