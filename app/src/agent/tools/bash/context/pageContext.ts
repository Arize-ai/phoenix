import { useMemo } from "react";
import { useLocation, useMatches, type UIMatch } from "react-router";

import type { AgentPageContext } from "@phoenix/agent/tools/bash/context/pageContextTypes";

type BuildAgentPageContextOptions = {
  pathname: string;
  search: string;
  matches: UIMatch[];
};

function collectSearchParams(search: string) {
  const searchParams = new URLSearchParams(search);
  const entries = new Map<string, string[]>();

  for (const [key, value] of searchParams.entries()) {
    const values = entries.get(key);

    if (values) {
      values.push(value);
    } else {
      entries.set(key, [value]);
    }
  }

  return Object.fromEntries(
    [...entries.entries()].map(([key, values]) => [
      key,
      values.length === 1 ? (values[0] ?? "") : values,
    ])
  );
}

function collectRouteMatchContext(matches: UIMatch[]) {
  return matches.map((match) => ({
    id: match.id,
    pathname: match.pathname,
    params: Object.fromEntries(
      Object.entries(match.params).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    ),
  }));
}

function stripBasename(pathname: string) {
  const basename = window.Config.basename;

  if (!basename || basename === "/") {
    return pathname;
  }

  return pathname.startsWith(basename)
    ? pathname.slice(basename.length) || "/"
    : pathname;
}

function collectRouteParams(matches: UIMatch[]) {
  return matches.reduce<Record<string, string>>((params, match) => {
    return {
      ...params,
      ...Object.fromEntries(
        Object.entries(match.params).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      ),
    };
  }, {});
}

/**
 * Builds a serializable snapshot of the current page context from React
 * Router state. This snapshot is written into the bash tool's `/phoenix`
 * virtual filesystem so the agent knows which page the user is viewing.
 */
export function buildAgentPageContext({
  pathname,
  search,
  matches,
}: BuildAgentPageContextOptions): AgentPageContext {
  const params = collectRouteParams(matches);
  const normalizedPathname = stripBasename(pathname);

  return {
    pathname: normalizedPathname,
    search,
    params,
    searchParams: collectSearchParams(search),
    routeMatches: collectRouteMatchContext(matches),
  };
}

/**
 * Hook that derives the current {@link AgentPageContext} from React Router.
 * Re-computes only when the pathname, search, or route matches change.
 */
export function useCurrentAgentPageContext() {
  const location = useLocation();
  const matches = useMatches();

  return useMemo(
    () =>
      buildAgentPageContext({
        pathname: location.pathname,
        search: location.search,
        matches,
      }),
    [location.pathname, location.search, matches]
  );
}
