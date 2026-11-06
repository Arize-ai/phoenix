/**
 * A live view of the data router's own navigation state. The router commits
 * a navigation to its internal state as soon as loaders settle; React's
 * committed location (what `useLocation` reports) can lag far behind when the
 * destination page suspends inside the navigation transition. Watching this
 * source instead of the rendered pathname is what lets `navigation.goTo`
 * distinguish "still loading" from "the router refused".
 */
export type RouterNavigationStateSource = {
  /** The router's committed pathname, with the app basename stripped. */
  getPathname: () => string;
  /** "idle" once no navigation is in flight. */
  getNavigationStatus: () => "idle" | "loading" | "submitting";
  /** Notifies on every router state change; returns an unsubscribe. */
  subscribe: (onStateChange: () => void) => () => void;
};

/**
 * The structural subset of a React Router data router (the object
 * `createBrowserRouter` returns) that the adapter needs. Typed structurally
 * so tests and non-router hosts can supply a stub.
 */
export type DataRouterLike = {
  state: {
    location: { pathname: string };
    navigation: { state: "idle" | "loading" | "submitting" };
  };
  subscribe: (onStateChange: () => void) => () => void;
};

let registeredSource: RouterNavigationStateSource | null = null;

/**
 * Stores the router navigation state source for later `navigation.goTo`
 * calls. Registered where the app's data router is created; `null` clears it
 * (used by tests).
 *
 * @param params - Registration inputs.
 * @param params.source - Live view of the data router's navigation state.
 */
export function registerRouterNavigationStateSource({
  source,
}: {
  source: RouterNavigationStateSource | null;
}): void {
  registeredSource = source;
}

/**
 * Reads the router navigation state source registered by the app router, or
 * `null` in hosts without a data router.
 */
export function getRegisteredRouterNavigationStateSource(): RouterNavigationStateSource | null {
  return registeredSource;
}

/**
 * Mirrors React Router's `stripBasename` (case-insensitive prefix, segment
 * boundary respected), except a pathname outside the basename is returned
 * unchanged instead of `null` — the caller only compares pathnames.
 */
function stripBasename({
  pathname,
  basename,
}: {
  pathname: string;
  basename: string;
}): string {
  if (basename === "/" || basename === "") {
    return pathname;
  }
  if (!pathname.toLowerCase().startsWith(basename.toLowerCase())) {
    return pathname;
  }
  const basenameEnd = basename.endsWith("/")
    ? basename.length - 1
    : basename.length;
  const nextChar = pathname.charAt(basenameEnd);
  if (nextChar && nextChar !== "/") {
    return pathname;
  }
  return pathname.slice(basenameEnd) || "/";
}

/**
 * Adapts a data router into a {@link RouterNavigationStateSource}. The
 * router's internal location keeps the basename; the source strips it so
 * pathnames compare against catalog paths (which are basename-relative, like
 * `useLocation`'s).
 *
 * @param params - Adapter inputs.
 * @param params.router - The app's data router (from `createBrowserRouter`).
 * @param params.basename - The basename the router was created with.
 */
export function createDataRouterNavigationStateSource({
  router,
  basename = "/",
}: {
  router: DataRouterLike;
  basename?: string;
}): RouterNavigationStateSource {
  return {
    getPathname: () =>
      stripBasename({ pathname: router.state.location.pathname, basename }),
    getNavigationStatus: () => router.state.navigation.state,
    subscribe: (onStateChange) => router.subscribe(onStateChange),
  };
}
