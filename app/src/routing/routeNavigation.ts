import type { RouteObject } from "react-router";
import { z } from "zod";

import { flattenRouteObjects } from "./routeObjects";

const routeNavigationSectionSchema = z.enum(["Pages", "Profile"]);

/**
 * Navigation sections in display order. Consumers (e.g. the search palette)
 * iterate this list rather than hardcoding their own copy, so a new section
 * added to the schema is picked up everywhere.
 */
export const routeNavigationSections = routeNavigationSectionSchema.options;

const routeNavigationMetadataSchema = z
  .object({
    section: routeNavigationSectionSchema,
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

/**
 * Safely reads navigation metadata from React Router's open-ended route handle.
 */
export function getRouteNavigationMetadata(
  handle: unknown
): RouteNavigationMetadata | null {
  const metadata =
    typeof handle === "object" && handle !== null && "navigation" in handle
      ? handle.navigation
      : undefined;
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
    // Consumers key collections (tabs, palette items) by path, so the catalog
    // must hold at most one entry per path; the first declaration wins.
    const hasExistingEntry = entries.some((entry) => entry.path === path);
    if (metadata && !hasExistingEntry) {
      entries.push({ path, metadata });
    }
  });

  return entries;
}

/**
 * Entries flagged requiresViewer are only meaningful when someone is logged
 * in, so they are hidden from navigation when there is no viewer.
 */
export function isRouteNavigationEntryVisible({
  entry,
  hasViewer,
}: {
  entry: RouteNavigationEntry;
  hasViewer: boolean;
}): boolean {
  return !entry.metadata.requiresViewer || hasViewer;
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
