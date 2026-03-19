import { useMemo } from "react";
import { useLocation, useMatches, type UIMatch } from "react-router";

import type {
  AgentPageContext,
  AgentTimeRangeContext,
} from "@phoenix/agent/context/pageContextTypes";
import { useNullableTimeRangeContext } from "@phoenix/components/datetime/TimeRangeContext";

type BuildAgentPageContextOptions = {
  pathname: string;
  search: string;
  matches: UIMatch[];
  timeRange: AgentTimeRangeContext | null;
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

export function buildAgentPageContext({
  pathname,
  search,
  matches,
  timeRange,
}: BuildAgentPageContextOptions): AgentPageContext {
  const params = collectRouteParams(matches);
  const normalizedPathname = stripBasename(pathname);

  return {
    pathname: normalizedPathname,
    search,
    params,
    searchParams: collectSearchParams(search),
    routeMatches: collectRouteMatchContext(matches),
    timeRange,
  };
}

export function getAgentTimeRangeContext(
  timeRangeContext: ReturnType<typeof useNullableTimeRangeContext>
): AgentTimeRangeContext | null {
  if (!timeRangeContext) {
    return null;
  }

  return {
    timeRangeKey: timeRangeContext.timeRange.timeRangeKey,
    start: timeRangeContext.timeRange.start?.toISOString() ?? null,
    end: timeRangeContext.timeRange.end?.toISOString() ?? null,
  };
}

export function useCurrentAgentPageContext() {
  const location = useLocation();
  const matches = useMatches();
  const timeRangeContext = useNullableTimeRangeContext();

  return useMemo(
    () =>
      buildAgentPageContext({
        pathname: location.pathname,
        search: location.search,
        matches,
        timeRange: getAgentTimeRangeContext(timeRangeContext),
      }),
    [location.pathname, location.search, matches, timeRangeContext]
  );
}
