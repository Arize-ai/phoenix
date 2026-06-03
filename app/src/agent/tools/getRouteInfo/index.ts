import { generatePath, type RouteObject } from "react-router";
import { z } from "zod";

import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";

export const GET_ROUTE_INFO_TOOL_NAME = "get_route_info";

const agentRouteMetadataSchema = z
  .object({
    label: z.string(),
    description: z.string(),
  })
  // Keep assistant-facing route metadata constrained to the intentionally
  // small contract documented by the tool: label and description only.
  .strict();

export type AgentRouteMetadata = z.infer<typeof agentRouteMetadataSchema>;

export type GetRouteInfoInput = {
  query?: string;
  path?: string;
  limit: number;
};

type RouteInfoHandle = {
  agentRoute?: unknown;
};

export type RouteCatalogEntry = {
  path: string;
  metadata: AgentRouteMetadata;
  routeIndex: number;
};

export type RouteInfoMatch = {
  path: string;
  label: string;
  description: string;
  link: string | null;
  missingParams: string[];
};

export type RouteInfoResult = {
  query?: string;
  path?: string;
  matches: RouteInfoMatch[];
};

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

/**
 * Converts React Router paths and user-provided path inputs into a comparable
 * root-relative pattern.
 *
 * @param path - Route path, URL path, or path fragment to normalize.
 */
function normalizePath(path: string): string {
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

/**
 * Splits free-form user text into simple lowercase search tokens.
 *
 * @param value - User query or route metadata text.
 */
function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

/**
 * Assigns a relevance score for a catalog entry against a free-form query.
 *
 * @param params - Scoring inputs.
 * @param params.entry - Catalog entry to score.
 * @param params.query - User query to compare against metadata and path.
 */
function scoreEntry({
  entry,
  query,
}: {
  entry: RouteCatalogEntry;
  query: string;
}): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return 1;
  }

  const queryTokens = tokenize(normalizedQuery);
  const label = entry.metadata.label.toLowerCase();
  const description = entry.metadata.description.toLowerCase();
  const path = entry.path.toLowerCase();

  let score = 0;
  // Whole-query matches get higher weights than token matches so phrases like
  // "data retention policy" prefer a route that explicitly names that phrase.
  if (label.includes(normalizedQuery)) {
    score += 12;
  }
  if (description.includes(normalizedQuery)) {
    score += 10;
  }
  if (path.includes(normalizedQuery)) {
    score += 4;
  }

  // Token matches make the search tolerant of partial questions while still
  // preferring user-facing label and description matches over path matches.
  for (const token of queryTokens) {
    if (label.includes(token)) {
      score += 5;
    }
    if (description.includes(token)) {
      score += 3;
    }
    if (path.includes(token)) {
      score += 1;
    }
  }

  return score;
}

/**
 * Finds dynamic route parameters in a React Router path pattern.
 *
 * @param path - Route path pattern such as `/projects/:projectId/traces`.
 */
function getRequiredParams(path: string): string[] {
  return Array.from(path.matchAll(/:([A-Za-z0-9_]+)/g)).map(
    ([, paramName]) => paramName ?? ""
  );
}

/**
 * Restores only encoded `=` padding in generated route links.
 *
 * React Router percent-encodes dynamic params, but Phoenix's existing internal
 * links render Relay-style IDs with raw `=` padding. Keep generated assistant
 * links consistent with that convention without broadly decoding escapes like
 * `%2F`, `%3F`, or `%23`, which would change the URL structure.
 *
 * @param path - Path generated by React Router.
 */
function restoreRouteParamPadding(path: string): string {
  return path.replace(/%3D/gi, "=");
}

/**
 * Derives route parameter values from the active PXI contexts.
 *
 * @param contexts - Active PXI contexts selected in the chat session.
 */
function buildParamsFromContexts(
  contexts: AgentContext[]
): Partial<Record<string, string>> {
  // The map is sparse because the current chat may only know about one entity
  // type. Callers must check for missing values before generating a link.
  const params: Partial<Record<string, string>> = {};
  for (const context of contexts) {
    if (context.type === "project") {
      params.projectId = context.projectNodeId;
    } else if (context.type === "trace") {
      params.projectId = context.projectNodeId;
      params.traceId = context.otelTraceId;
    } else if (context.type === "span" && context.spanNodeId) {
      params.spanId = context.spanNodeId;
      if (context.projectNodeId) {
        params.projectId = context.projectNodeId;
      }
    } else if (context.type === "dataset") {
      params.datasetId = context.datasetNodeId;
    }
  }
  return params;
}

/**
 * Converts a catalog entry into the tool response shape and generates a link
 * when all dynamic route params are known.
 *
 * @param params - Match construction inputs.
 * @param params.entry - Catalog entry selected by search or path lookup.
 * @param params.currentParams - Route params derived from active PXI contexts.
 */
function buildMatch({
  entry,
  currentParams,
}: {
  entry: RouteCatalogEntry;
  currentParams: Partial<Record<string, string>>;
}): RouteInfoMatch {
  const requiredParams = getRequiredParams(entry.path);
  const missingParams = requiredParams.filter(
    (paramName) => currentParams[paramName] == null
  );
  // `generatePath` expects every named param to be present. The placeholder
  // values are never used when any param is missing because `link` becomes null.
  const generateParams = Object.fromEntries(
    requiredParams.map((paramName) => [
      paramName,
      currentParams[paramName] ?? "",
    ])
  );
  const link =
    missingParams.length === 0
      ? restoreRouteParamPadding(generatePath(entry.path, generateParams))
      : null;
  return {
    path: entry.path,
    label: entry.metadata.label,
    description: entry.metadata.description,
    link,
    missingParams,
  };
}

/**
 * Normalizes path input from either a raw path or a full URL.
 *
 * @param path - Path or URL provided by the tool caller.
 */
function normalizeInputPath(path: string): string {
  try {
    // The browser URL parser lets the tool accept absolute URLs while still
    // comparing only the Phoenix-internal pathname against route patterns.
    const url = new URL(path, window.location.href);
    return normalizePath(url.pathname);
  } catch {
    return normalizePath(path);
  }
}

/**
 * Validates and normalizes raw tool input from the browser tool registry.
 *
 * @param input - Unknown tool input provided by the model/tool call.
 */
export function parseGetRouteInfoInput(
  input: unknown
): GetRouteInfoInput | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const candidate = input as {
    query?: unknown;
    path?: unknown;
    limit?: unknown;
  };
  if (candidate.query !== undefined && typeof candidate.query !== "string") {
    return null;
  }
  if (candidate.path !== undefined && typeof candidate.path !== "string") {
    return null;
  }
  let limit = DEFAULT_LIMIT;
  if (candidate.limit !== undefined) {
    if (
      typeof candidate.limit !== "number" ||
      !Number.isInteger(candidate.limit) ||
      candidate.limit <= 0
    ) {
      return null;
    }
    limit = candidate.limit;
  }
  return {
    // Preserve whether query/path were omitted so the response mirrors the
    // caller input without adding empty fields.
    ...(candidate.query !== undefined ? { query: candidate.query } : {}),
    ...(candidate.path !== undefined ? { path: candidate.path } : {}),
    limit: Math.min(limit, MAX_LIMIT),
  };
}

/**
 * Searches a prebuilt route catalog and returns bounded route matches.
 *
 * @param params - Route lookup inputs.
 * @param params.catalog - Flattened route catalog to search.
 * @param params.input - Parsed tool input.
 * @param params.contexts - Active PXI contexts used for link generation.
 */
export function getRouteInfoFromCatalog({
  catalog,
  input,
  contexts,
}: {
  catalog: RouteCatalogEntry[];
  input: GetRouteInfoInput;
  contexts: AgentContext[];
}): RouteInfoResult {
  const currentParams = buildParamsFromContexts(contexts);
  const normalizedPath = input.path ? normalizeInputPath(input.path) : null;
  const scoredEntries = catalog
    .map((entry) => ({
      entry,
      // Exact path lookup should win over fuzzy query scoring and return only
      // the catalog entry for that path.
      score:
        normalizedPath !== null && entry.path === normalizedPath
          ? Number.MAX_SAFE_INTEGER
          : scoreEntry({ entry, query: input.query ?? "" }),
    }))
    .filter(({ score }) => {
      if (normalizedPath !== null) {
        return score === Number.MAX_SAFE_INTEGER;
      }
      // Empty queries intentionally browse the catalog with the default limit;
      // unknown non-empty queries return no matches instead of dumping routes.
      return input.query == null || input.query.trim() === "" || score > 0;
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.entry.routeIndex - right.entry.routeIndex;
    })
    .slice(0, input.limit);

  return {
    ...(input.query !== undefined ? { query: input.query } : {}),
    ...(input.path !== undefined ? { path: input.path } : {}),
    matches: scoredEntries.map(({ entry }) =>
      buildMatch({ entry, currentParams })
    ),
  };
}

/**
 * Builds the live catalog from Phoenix's React Router route tree and searches
 * it for the current tool call.
 *
 * @param params - Tool execution inputs.
 * @param params.input - Parsed tool input.
 * @param params.contexts - Active PXI contexts used for link generation.
 */
export async function getRouteInfo({
  input,
  contexts,
}: {
  input: GetRouteInfoInput;
  contexts: AgentContext[];
}): Promise<RouteInfoResult> {
  // Import lazily so normal PXI chat requests do not load or serialize the
  // route catalog unless the browser-executed tool is actually called.
  const { appRouteObjects } = await import("@phoenix/Routes");
  return getRouteInfoFromCatalog({
    catalog: buildRouteInfoCatalog(appRouteObjects),
    input,
    contexts,
  });
}
