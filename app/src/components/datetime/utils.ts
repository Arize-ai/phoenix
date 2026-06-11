import {
  startOfHour,
  startOfMinute,
  subDays,
  subHours,
  subMinutes,
} from "date-fns";

import { assertUnreachable } from "@phoenix/typeUtils";

import { LAST_N_TIME_RANGES_MAP } from "./constants";
import type {
  LastNTimeRangeKey,
  LastNTimeRangeUnit,
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
