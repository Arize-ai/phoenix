/**
 * How long after a route change an operation that is not mounted yet is
 * worth waiting for. A page registers its operations once its data loads,
 * which can be well after the route commits (a form behind a Suspense
 * boundary), so a script that navigates and then calls the page's
 * operation would otherwise fail on its first call and have to retry.
 */
export const ROUTE_SETTLE_WINDOW_MS = 15_000;

/** The longest dispatch waits for an operation to mount after a route change. */
export const ROUTE_SETTLE_MOUNT_TIMEOUT_MS = 5_000;

let lastRouteChangeAt: number | null = null;

/** Records that the route just changed; called by the root registration. */
export function markRouteChanged(now: number = Date.now()) {
  lastRouteChangeAt = now;
}

/**
 * How long dispatch should wait for an unmounted operation: up to
 * {@link ROUTE_SETTLE_MOUNT_TIMEOUT_MS} while the route changed recently, and
 * not at all otherwise, so an operation that belongs to another page still
 * fails fast.
 */
export function getRouteSettleWaitMs(now: number = Date.now()): number {
  if (lastRouteChangeAt == null) {
    return 0;
  }
  const elapsed = now - lastRouteChangeAt;
  if (elapsed < 0 || elapsed > ROUTE_SETTLE_WINDOW_MS) {
    return 0;
  }
  return ROUTE_SETTLE_MOUNT_TIMEOUT_MS;
}

/** Test-only: forget the last route change. */
export function resetRouteSettleForTests() {
  lastRouteChangeAt = null;
}
