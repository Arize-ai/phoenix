import {
  NAVIGATION_BLOCKED_ERROR,
  NAVIGATION_DECLINED_ERROR,
} from "./constants";
import type { BindPendingNavigationOptions, PendingNavigation } from "./types";

/**
 * Wait for the router to commit (or refuse) the navigation. Route blockers
 * refuse silently from the caller's perspective, so the binder polls the
 * pathname over a few animation frames instead of assuming success.
 */
async function didNavigate(
  getCurrentPath: () => string,
  targetPath: string,
  frames = 10
): Promise<boolean> {
  for (let i = 0; i < frames; i++) {
    if (getCurrentPath() === targetPath) {
      return true;
    }
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 16);
      }
    });
  }
  return getCurrentPath() === targetPath;
}

/**
 * Attach accept/reject to a pending navigation. Accept performs the route
 * change and resolves only after the router commits it, so the script's next
 * operation call does not race the destination page's handler registration
 * window by a full navigation. A navigation the router refuses (an active
 * blocker guarding unsaved work) resolves `{ ok: false }` so the model
 * explains instead of retrying. Reject resolves `{ ok: false }` with a
 * do-not-retry instruction — the graceful floor is offering the user a link.
 */
export function bindPendingNavigationActions({
  pendingNavigation,
  navigate,
  getCurrentPath,
  emitResult,
  setPendingNavigation,
}: BindPendingNavigationOptions): PendingNavigation {
  const { path, label } = pendingNavigation;
  return {
    ...pendingNavigation,
    accept: async () => {
      setPendingNavigation(pendingNavigation.toolCallId, null);
      navigate(path);
      const navigated = await didNavigate(getCurrentPath, path);
      if (!navigated) {
        emitResult({ ok: false, error: NAVIGATION_BLOCKED_ERROR });
        return;
      }
      emitResult({
        ok: true,
        output: {
          status: "navigated",
          path,
          label,
          message:
            `The user is now on ${label} (${path}). Operations of that page ` +
            "register as it mounts; if a call reports not-mounted immediately " +
            "after navigation, retry it once.",
        },
      });
    },
    reject: async () => {
      setPendingNavigation(pendingNavigation.toolCallId, null);
      emitResult({ ok: false, error: NAVIGATION_DECLINED_ERROR });
    },
  };
}
