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

export { getLocalTimeZone };
