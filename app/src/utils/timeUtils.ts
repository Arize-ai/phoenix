// Singleton to get the current locale and time zone
const resolvedOptions = Intl.DateTimeFormat().resolvedOptions();

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
