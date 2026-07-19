import type { RouteObject } from "react-router";
import { z } from "zod";

import { flattenRouteObjects } from "./routeObjects";

const routeNavigationMetadataSchema = z
  .object({
    section: z.enum(["Pages", "Profile"]),
    label: z.string().min(1),
    description: z.string().min(1),
    icon: z.enum([
      "Code",
      "Database",
      "GraphQL",
      "Grid",
      "Key",
      "Link2",
      "MessageSquare",
      "Options",
      "Person",
      "PlayCircle",
      "Scale",
      "Trace",
    ]),
    requiresViewer: z.boolean().optional(),
  })
  .strict();

export type RouteNavigationMetadata = z.infer<
  typeof routeNavigationMetadataSchema
>;

export type RouteNavigationEntry = {
  path: string;
  metadata: RouteNavigationMetadata;
};

type RouteNavigationHandle = {
  navigation?: unknown;
};

/**
 * Safely reads navigation metadata from React Router's open-ended route handle.
 */
export function getRouteNavigationMetadata(
  handle: unknown
): RouteNavigationMetadata | null {
  const metadata = (handle as RouteNavigationHandle | undefined)?.navigation;
  const result = routeNavigationMetadataSchema.safeParse(metadata);
  return result.success ? result.data : null;
}

/**
 * Derives user-facing navigation destinations from the application router.
 */
export function buildRouteNavigationCatalog(
  routes: RouteObject[]
): RouteNavigationEntry[] {
  const entries: RouteNavigationEntry[] = [];

  flattenRouteObjects(routes).forEach(({ path, route }) => {
    const metadata = getRouteNavigationMetadata(route.handle);
    const hasExistingEntry = entries.some(
      (entry) => entry.path === path && entry.metadata.label === metadata?.label
    );
    if (metadata && !hasExistingEntry) {
      entries.push({ path, metadata });
    }
  });

  return entries;
}

let registeredRouteNavigationCatalog: RouteNavigationEntry[] = [];

export function registerRouteNavigationCatalog({
  catalog,
}: {
  catalog: RouteNavigationEntry[];
}): void {
  registeredRouteNavigationCatalog = catalog;
}

export function getRegisteredRouteNavigationCatalog(): RouteNavigationEntry[] {
  return registeredRouteNavigationCatalog;
}
