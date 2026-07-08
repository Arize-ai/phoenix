import { getLocalTimeZone } from "@internationalized/date";

// Singleton to get the current locale and time zone
const resolvedOptions = Intl.DateTimeFormat().resolvedOptions();

let _supportedTimezones: Array<string> = [];
/**
 * Returns the current locale
 */
export function getLocale(): string {
  return resolvedOptions.locale;
}

/**
 * Returns the current time zone
 */
export function getTimeZone(): string {
  return resolvedOptions.timeZone;
}

/*
 * A function that returns a full list of timezones supported by the browser
 * Uses dynamic programming in order to avoid re-calculating and allows the browser to resolve the list of timezones.
 */
export function getSupportedTimezones(): ReadonlyArray<string> {
  if (_supportedTimezones.length === 0) {
    _supportedTimezones = [...Intl.supportedValuesOf("timeZone")];
    // Safari and others contain UTC in the list while chrome does not.
    if (!_supportedTimezones.includes("UTC")) {
      _supportedTimezones = ["UTC", ..._supportedTimezones];
    }
  }
  return Object.freeze([..._supportedTimezones]);
}

/**
 * Format a Date as a local ISO 8601 string with a UTC offset suffix,
 * e.g. `2026-05-05T10:30:00-07:00`.
 *
 * Uses {@link Intl.DateTimeFormat.formatToParts} to extract wall-clock
 * components in the target timezone, then derives the UTC offset
 * arithmetically. No locale-specific formatting hacks required.
 */
export function toLocalISOWithOffset(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});

  let { year, month, day } = parts;
  let hour = parts.hour;
  // Intl may render midnight as "24" on the previous day in some engines;
  // normalise to "00" and advance the calendar day so datePart and the
  // offset calculation stay correct.
  if (hour === "24") {
    hour = "00";
    const d = new Date(`${year}-${month}-${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    year = String(d.getUTCFullYear());
    month = String(d.getUTCMonth() + 1).padStart(2, "0");
    day = String(d.getUTCDate()).padStart(2, "0");
  }
  const datePart = `${year}-${month}-${day}`;
  const timePart = `${hour}:${parts.minute}:${parts.second}`;

  // Derive the UTC offset by comparing the wall-clock epoch to the real epoch.
  // Interpreting the wall-clock string as UTC gives a value offset from the
  // true instant by exactly the timezone's UTC offset:
  //   wallAsUTC - realUTC = +9h for Asia/Tokyo, -8h for America/Los_Angeles.
  const wallAsUtc = new Date(`${datePart}T${timePart}Z`).getTime();
  const totalMinutes = Math.round((wallAsUtc - date.getTime()) / 60_000);
  const sign = totalMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(totalMinutes);
  const offsetH = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const offsetM = String(absMinutes % 60).padStart(2, "0");

  return `${datePart}T${timePart}${sign}${offsetH}:${offsetM}`;
}

export { getLocalTimeZone };
