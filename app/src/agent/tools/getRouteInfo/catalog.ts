import type { RouteObject } from "react-router";

import { flattenRouteObjects } from "@phoenix/routing/routeObjects";

import { agentRouteMetadataSchema } from "./schemas";
import type { AgentRouteMetadata } from "./schemas";
import type { RouteCatalogEntry, RouteInfoHandle } from "./types";

export { normalizePath } from "@phoenix/routing/routeObjects";

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

  flattenRouteObjects(routes).forEach(({ path, route }) => {
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
  });
  return entries;
}
