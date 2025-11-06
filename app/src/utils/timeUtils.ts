/**
 * Returns the current locale
 */
export function getLocale(): string {
  return Intl.DateTimeFormat().resolvedOptions().locale;
}

/**
 * Returns the current time zone
 */
export function getTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
