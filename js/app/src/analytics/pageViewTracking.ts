import { getRoutePattern, type RouteMatchLike } from "./routePattern";

/**
 * The structural subset of a React Router data router (the object
 * `createBrowserRouter` returns) that page view tracking reads.
 */
export type PageViewRouterLike = {
  state: PageViewRouterState;
  subscribe: (
    onStateChange: (state: PageViewRouterState) => void
  ) => () => void;
};

type PageViewRouterState = {
  initialized: boolean;
  navigation: { state: "idle" | "loading" | "submitting" };
  location: { pathname: string };
  matches: readonly RouteMatchLike[];
};

/**
 * Reports a page view each time the router settles on a new pathname.
 * Search-param changes (filters, selections) are not page views.
 *
 * @param params - Tracking inputs.
 * @param params.router - The app's data router.
 * @param params.onPageView - Receives the route pattern of each page view.
 * @returns A function that stops tracking.
 */
export function trackPageViews({
  router,
  onPageView,
}: {
  router: PageViewRouterLike;
  onPageView: (routePattern: string) => void;
}): () => void {
  let lastPathname: string | null = null;
  const reportIfSettled = (state: PageViewRouterState) => {
    const isSettled = state.initialized && state.navigation.state === "idle";
    if (!isSettled || state.location.pathname === lastPathname) {
      return;
    }
    lastPathname = state.location.pathname;
    onPageView(getRoutePattern({ matches: state.matches }));
  };
  reportIfSettled(router.state);
  return router.subscribe(reportIfSettled);
}
