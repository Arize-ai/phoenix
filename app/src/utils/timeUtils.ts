import { getLocalTimeZone } from "@internationalized/date";

// Singleton to get the current locale and time zone
const resolvedOptions = Intl.DateTimeFormat().resolvedOptions();

const supportedTimezones = ["UTC", ...Intl.supportedValuesOf("timeZone")];

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
 */
export function getSupportedTimezones(): string[] {
  return supportedTimezones;
}

export { getLocalTimeZone };
