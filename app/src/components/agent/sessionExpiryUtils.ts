import { ONE_DAY_MS, ONE_HOUR_MS } from "@phoenix/constants/timeConstants";

/**
 * How far ahead of a session's retention deadline the session list starts
 * showing the "expires in …" affordance.
 */
export const EXPIRING_SOON_WINDOW_MS = 7 * ONE_DAY_MS;

/**
 * Inputs for {@link getSessionRetentionLabel}.
 */
export type SessionRetentionLabelParams = {
  /**
   * When the workspace idle-retention rule will delete the session, in epoch
   * milliseconds. Null when the session is temporary or idle retention is off.
   */
  expiresAt: number | null;
  /**
   * Whether the session is beyond the workspace per-user count cap and will
   * be deleted at the next retention sweep.
   */
  isOverCountCap: boolean;
  now: number;
};

/**
 * Returns the retention affordance text for a session list item, or null when
 * the session is in no danger of being deleted soon.
 *
 * Retention is enforced by an hourly sweep, so a deadline that has already
 * passed (or a session over the count cap) reads as "deleted soon" rather
 * than a countdown.
 */
export function getSessionRetentionLabel({
  expiresAt,
  isOverCountCap,
  now,
}: SessionRetentionLabelParams): string | null {
  if (isOverCountCap) {
    return "deleted soon";
  }
  if (expiresAt == null) {
    return null;
  }
  const remainingMs = expiresAt - now;
  if (remainingMs <= ONE_HOUR_MS) {
    return "deleted soon";
  }
  if (remainingMs < ONE_DAY_MS) {
    return `expires in ${Math.ceil(remainingMs / ONE_HOUR_MS)}h`;
  }
  if (remainingMs <= EXPIRING_SOON_WINDOW_MS) {
    return `expires in ${Math.ceil(remainingMs / ONE_DAY_MS)}d`;
  }
  return null;
}
