import type { RouteObject } from "react-router";

import { agentRouteMetadataSchema } from "./schemas";
import type { AgentRouteMetadata } from "./schemas";
import type { RouteCatalogEntry, RouteInfoHandle } from "./types";

/**
 * Converts React Router paths and user-provided path inputs into a comparable
 * root-relative pattern.
 *
 * @param path - Route path, URL path, or path fragment to normalize.
 */
export function normalizePath(path: string): string {
  if (path === "") {
    return "/";
  }
  const pathWithLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  // React Router patterns are compared without trailing slashes so "/settings/"
  // and "/settings" resolve to the same catalog entry.
  return pathWithLeadingSlash.length > 1
    ? pathWithLeadingSlash.replace(/\/+$/, "")
    : pathWithLeadingSlash;
}

/**
 * Builds the full path pattern for a route based on its parent path.
 *
 * @param params - Route path inputs.
 * @param params.parentPath - Already-flattened path from ancestor routes.
 * @param params.routePath - Current React Router route path.
 * @param params.isIndexRoute - Whether the route is an index route.
 */
function joinRoutePath({
  parentPath,
  routePath,
  isIndexRoute,
}: {
  parentPath: string;
  routePath: string | undefined;
  isIndexRoute: boolean | undefined;
}): string {
  // Index routes and pathless layout routes render at the parent URL.
  if (isIndexRoute || routePath == null) {
    return parentPath;
  }
  // Absolute child route paths replace the parent path in React Router.
  if (routePath.startsWith("/")) {
    return normalizePath(routePath);
  }
  return normalizePath(
    parentPath === "/" ? `/${routePath}` : `${parentPath}/${routePath}`
  );
}

/**
 * Checks whether a route handle value matches the PXI metadata contract.
 *
 * @param value - Unknown `handle.agentRoute` value from a React Router route.
 */
function isAgentRouteMetadata(value: unknown): value is AgentRouteMetadata {
  return agentRouteMetadataSchema.safeParse(value).success;
}

/**
 * Extracts PXI route metadata from a React Router route object.
 *
 * @param route - React Router route object from `appRouteObjects`.
 */
function getAgentRouteMetadata(route: RouteObject): AgentRouteMetadata | null {
  // React Router leaves `handle` intentionally open-ended, so the local handle
  // type keeps `agentRoute` as unknown until the Zod guard validates it.
  const handle = route.handle as RouteInfoHandle | undefined;
  const metadata = handle?.agentRoute;
  return isAgentRouteMetadata(metadata) ? metadata : null;
}

/**
 * Flattens React Router route objects into the small route catalog PXI can
 * search. Routes are included only when they define `handle.agentRoute`.
 *
 * @param routes - React Router route tree, usually `appRouteObjects`.
 */
export function buildRouteInfoCatalog(
  routes: RouteObject[]
): RouteCatalogEntry[] {
  const entries: RouteCatalogEntry[] = [];

  const visit = ({
    route,
    parentPath,
  }: {
    route: RouteObject;
    parentPath: string;
  }) => {
    const path = joinRoutePath({
      parentPath,
      routePath: route.path,
      isIndexRoute: route.index,
    });
    const metadata = getAgentRouteMetadata(route);
    // React Router can produce duplicate effective paths through nested layout
    // and index routes. Keep the first entry for a given path+label so ranking
    // stays deterministic without hiding intentionally distinct labels.
    const hasExistingEntry = entries.some(
      (entry) => entry.path === path && entry.metadata.label === metadata?.label
    );
    if (metadata && !hasExistingEntry) {
      entries.push({
        path,
        metadata,
        // Preserve declaration order as the stable tie-breaker for equally
        // relevant matches.
        routeIndex: entries.length,
      });
    }
    route.children?.forEach((childRoute) =>
      visit({ route: childRoute, parentPath: path })
    );
  };

  routes.forEach((route) => visit({ route, parentPath: "/" }));
  return entries;
}
