import {
  buildNavigationSettledElsewhereError,
  NAVIGATION_BLOCKED_ERROR,
  NAVIGATION_DECLINED_ERROR,
} from "./constants";
import { getRegisteredRouterNavigationStateSource } from "./routerStateRegistry";
import type { RouterNavigationStateSource } from "./routerStateRegistry";
import type { BindPendingNavigationOptions, PendingNavigation } from "./types";

/**
 * How long to wait for the router to settle before reporting the navigation
 * as blocked. Generous on purpose: settle only waits on route loaders (not
 * the destination page's render), and a false "blocked" on a navigation that
 * lands moments later misleads the model into telling the user about unsaved
 * work that does not exist.
 */
const NAVIGATION_SETTLE_TIMEOUT_MS = 10_000;

type NavigationSettleOutcome =
  | { status: "navigated" }
  | { status: "settled-elsewhere"; pathname: string }
  | { status: "timed-out" };

/**
 * Watch the router's own state until the navigation settles. The router
 * commits its location as soon as loaders resolve, while the *rendered*
 * pathname (`useLocation`) lags behind whenever the destination suspends
 * inside the navigation transition — so polling the rendered pathname
 * misreports slow-loading pages as blocked. Subscribes before starting the
 * navigation so a synchronous settle cannot be missed.
 *
 * @param params - Settle-watch inputs.
 * @param params.source - Live view of the data router's navigation state.
 * @param params.targetPath - The pathname the navigation should land on.
 * @param params.beginNavigation - Starts the navigation; called once,
 *   after subscribing.
 * @param params.timeoutMs - Give-up budget for a router that never settles
 *   (e.g. a blocker holding the navigation open).
 */
function waitForNavigationSettle({
  source,
  targetPath,
  beginNavigation,
  timeoutMs = NAVIGATION_SETTLE_TIMEOUT_MS,
}: {
  source: RouterNavigationStateSource;
  targetPath: string;
  beginNavigation: () => void;
  timeoutMs?: number;
}): Promise<NavigationSettleOutcome> {
  return new Promise((resolve) => {
    let hasNavigationStarted = false;
    let isSettled = false;
    const finish = (outcome: NavigationSettleOutcome) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      clearTimeout(timeoutId);
      unsubscribe();
      resolve(outcome);
    };
    const checkRouterState = () => {
      if (source.getPathname() === targetPath) {
        finish({ status: "navigated" });
        return;
      }
      if (source.getNavigationStatus() !== "idle") {
        hasNavigationStarted = true;
        return;
      }
      if (hasNavigationStarted) {
        // The navigation ran but the router settled somewhere else — a
        // redirecting loader, or a blocker that reverted it.
        finish({ status: "settled-elsewhere", pathname: source.getPathname() });
      }
    };
    // `finish` only runs from the subscription or the timeout, so both
    // bindings exist before it can be called.
    const timeoutId = setTimeout(
      () => finish({ status: "timed-out" }),
      timeoutMs
    );
    const unsubscribe = source.subscribe(checkRouterState);
    beginNavigation();
    checkRouterState();
  });
}

/**
 * Fallback settle check for hosts with no registered router state source
 * (unit tests, non-data-router embeddings): poll the rendered pathname over a
 * few animation frames. In the real app the router source is always
 * registered and this path is not taken — the rendered pathname lags the
 * router whenever the destination page suspends, so frame-polling it
 * misreports slow pages as blocked.
 */
async function didNavigate(
  getCurrentPath: () => string,
  targetPath: string,
  frames = 10
): Promise<boolean> {
  for (let frame = 0; frame < frames; frame++) {
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

function buildNavigatedResult({
  path,
  label,
}: {
  path: string;
  label: string;
}) {
  return {
    ok: true as const,
    output: {
      status: "navigated",
      path,
      label,
      message:
        `The user is now on ${label} (${path}). Operations of that page ` +
        "register as it mounts; if a call reports not-mounted immediately " +
        "after navigation, retry it once.",
    },
  };
}

/**
 * Attach accept/reject to a pending navigation. Accept performs the route
 * change and resolves only after the router settles it, so the script's next
 * operation call does not race the destination page's handler registration
 * window by a full navigation. Settling is judged from the router's own
 * state (see {@link waitForNavigationSettle}); a navigation the router
 * refuses or diverts resolves `{ ok: false }` so the model explains instead
 * of retrying. Reject resolves `{ ok: false }` with a do-not-retry
 * instruction — the graceful floor is offering the user a link.
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
      const routerSource = getRegisteredRouterNavigationStateSource();
      if (!routerSource) {
        navigate(path);
        const navigated = await didNavigate(getCurrentPath, path);
        emitResult(
          navigated
            ? buildNavigatedResult({ path, label })
            : { ok: false, error: NAVIGATION_BLOCKED_ERROR }
        );
        return;
      }
      const outcome = await waitForNavigationSettle({
        source: routerSource,
        targetPath: path,
        beginNavigation: () => navigate(path),
      });
      switch (outcome.status) {
        case "navigated":
          emitResult(buildNavigatedResult({ path, label }));
          break;
        case "settled-elsewhere":
          emitResult({
            ok: false,
            error: buildNavigationSettledElsewhereError({
              requestedPath: path,
              settledPath: outcome.pathname,
            }),
          });
          break;
        case "timed-out":
          emitResult({ ok: false, error: NAVIGATION_BLOCKED_ERROR });
          break;
      }
    },
    reject: async () => {
      setPendingNavigation(pendingNavigation.toolCallId, null);
      emitResult({ ok: false, error: NAVIGATION_DECLINED_ERROR });
    },
  };
}
