/**
 * Email utility functions for handling null email markers.
 *
 * LDAP users without email attributes have a special marker in the database
 * instead of a real email address. This module provides helpers to detect
 * and handle these markers in the UI.
 */

/**
 * Check if an email is a null email marker (placeholder for LDAP users without email).
 *
 * The null email marker is a special value used in the database when an LDAP
 * directory doesn't have email attributes configured. It starts with a Private
 * Use Area Unicode character to ensure it can never conflict with real emails.
 *
 * @param email - The email to check
 * @returns true if the email is a null email marker, false otherwise
 *
 * @example
 * ```ts
 * isNullEmailMarker("\uE000NULLabcd1234...") // true
 * isNullEmailMarker("user@example.com")      // false
 * isNullEmailMarker(null)                    // false
 * ```
 */
export function isNullEmailMarker(email: string | null | undefined): boolean {
  const markerPrefix = window.Config.nullEmailMarkerPrefix;
  if (!markerPrefix || !email) {
    return false;
  }
  return email.startsWith(markerPrefix);
}

/**
 * Get the display value for an email, handling null email markers.
 *
 * If the email is a null email marker, returns an empty string or a fallback.
 * Otherwise returns the email unchanged.
 *
 * @param email - The email to display
 * @param fallback - Optional fallback value when email is a marker (default: "")
 * @returns The email to display, or fallback if it's a marker
 */
export function getDisplayEmail(
  email: string | null | undefined,
  fallback: string = ""
): string {
  if (!email || isNullEmailMarker(email)) {
    return fallback;
  }
  return email;
}
