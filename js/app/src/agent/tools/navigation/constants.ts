export const NAVIGATION_DECLINED_ERROR =
  "The user declined the navigation. Do not retry it; offer a link to the destination instead.";

export const NAVIGATION_BLOCKED_ERROR =
  "Navigation did not complete — the router never committed the route change (a navigation blocker or unsaved work may be holding it). Ask the user to navigate manually.";

/**
 * Builds the error for a navigation the router settled somewhere other than
 * the requested path — a redirecting loader or a reverting blocker.
 *
 * @param params - Message inputs.
 * @param params.requestedPath - The path the navigation asked for.
 * @param params.settledPath - Where the router actually ended up.
 */
export function buildNavigationSettledElsewhereError({
  requestedPath,
  settledPath,
}: {
  requestedPath: string;
  settledPath: string;
}): string {
  return (
    `Navigation ended on "${settledPath}" instead of "${requestedPath}" — ` +
    "the router redirected or reverted the change. Treat the user as being " +
    `on "${settledPath}" now.`
  );
}

export const NAVIGATION_STALE_ERROR =
  "The page changed after this navigation was proposed, so it can no longer be applied.";
