export const SESSION_CANCELLATION_GRACE_MS = 3_000;

/**
 * Checks whether a session's local cancellation grace period is currently active.
 *
 * During this grace period, busy-conflict errors (HTTP 409) and active turn locks
 * are treated as artifacts of this client's own recently cancelled turn rather than
 * another client acquiring the lock.
 */
export function isSessionSelfCancellationGraceActive(
  cancelledAt: number | null | undefined,
  now: number = Date.now()
): boolean {
  if (cancelledAt == null) {
    return false;
  }
  const elapsedMs = now - cancelledAt;
  return elapsedMs >= 0 && elapsedMs <= SESSION_CANCELLATION_GRACE_MS;
}
