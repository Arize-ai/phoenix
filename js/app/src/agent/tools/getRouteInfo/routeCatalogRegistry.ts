import type { RouteCatalogEntry } from "./types";

let registeredRouteInfoCatalog: RouteCatalogEntry[] = [];

/**
 * Stores the route catalog derived from the app router for later tool calls.
 *
 * @param params - Catalog registration inputs.
 * @param params.catalog - Flattened route catalog built from the router tree.
 */
export function registerRouteInfoCatalog({
  catalog,
}: {
  catalog: RouteCatalogEntry[];
}): void {
  registeredRouteInfoCatalog = catalog;
}

/**
 * Reads the current route catalog registered by the app router.
 */
export function getRegisteredRouteInfoCatalog(): RouteCatalogEntry[] {
  return registeredRouteInfoCatalog;
}
