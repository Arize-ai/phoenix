/**
 * The part of a React Router match that names its route definition.
 */
export type RouteMatchLike = {
  route: { path?: string };
};

/**
 * Builds the route pattern (e.g. `/projects/:projectId/traces/:traceId`)
 * for a list of nested route matches. The pattern carries the route shape
 * only, never the parameter values or the app basename, so it is safe to
 * report as anonymous analytics.
 *
 * @param params - Pattern inputs.
 * @param params.matches - The router's matches, outermost first.
 */
export function getRoutePattern({
  matches,
}: {
  matches: readonly RouteMatchLike[];
}): string {
  const segments = matches.reduce<string[]>((accumulated, match) => {
    const path = match.route.path;
    if (!path) {
      return accumulated;
    }
    return path.startsWith("/") ? [path] : [...accumulated, path];
  }, []);
  const pattern = `/${segments.join("/")}`.replace(/\/{2,}/g, "/");
  return pattern.length > 1 ? pattern.replace(/\/$/, "") : pattern;
}
