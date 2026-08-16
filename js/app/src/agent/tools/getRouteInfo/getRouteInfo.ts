import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";

import { normalizeInputPath } from "./parsers";
import { getRegisteredRouteInfoCatalog } from "./routeCatalogRegistry";
import { buildMatch, buildParamsFromContexts } from "./routeParams";
import { scoreEntry } from "./scoring";
import type {
  GetRouteInfoInput,
  RouteCatalogEntry,
  RouteInfoResult,
} from "./types";

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
  return getRouteInfoFromCatalog({
    catalog: getRegisteredRouteInfoCatalog(),
    input,
    contexts,
  });
}
