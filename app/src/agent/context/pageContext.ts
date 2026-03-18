import { useMemo } from "react";
import { useLocation, useMatches, type UIMatch } from "react-router";

import type {
  AgentPageContext,
  AgentTimeRangeContext,
} from "@phoenix/agent/context/pageContextTypes";
import { useNullableTimeRangeContext } from "@phoenix/components/datetime/TimeRangeContext";

const PROJECT_PAGE_TABS = new Set([
  "spans",
  "traces",
  "sessions",
  "metrics",
  "config",
]);

type BuildAgentPageContextOptions = {
  pathname: string;
  search: string;
  matches: UIMatch[];
  timeRange: AgentTimeRangeContext | null;
};

function getPathSegments(pathname: string) {
  return stripBasename(pathname).split("/").filter(Boolean);
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

function getProjectTabFromPath(
  pathname: string,
  projectId: string | undefined
) {
  if (!projectId) {
    return null;
  }

  const segments = getPathSegments(pathname);
  const projectIndex = segments.indexOf(projectId);
  const nextSegment = projectIndex >= 0 ? segments[projectIndex + 1] : null;

  return nextSegment && PROJECT_PAGE_TABS.has(nextSegment) ? nextSegment : null;
}

function getPageKind({
  projectId,
  traceId,
}: {
  projectId: string | null;
  traceId: string | null;
}) {
  if (projectId && traceId) {
    return "trace";
  }

  if (projectId) {
    return "project";
  }

  return "generic";
}

export function buildAgentPageContext({
  pathname,
  search,
  matches,
  timeRange,
}: BuildAgentPageContextOptions): AgentPageContext {
  const params = collectRouteParams(matches);
  const projectId = params.projectId ?? null;
  const traceId = params.traceId ?? null;
  const projectTab = getProjectTabFromPath(pathname, projectId ?? undefined);
  const normalizedPathname = stripBasename(pathname);

  return {
    pathname: normalizedPathname,
    search,
    params,
    pageKind: getPageKind({ projectId, traceId }),
    projectId,
    traceId,
    projectTab,
    timeRange,
  };
}

export function getAgentPageContextSignature(pageContext: AgentPageContext) {
  return JSON.stringify(pageContext);
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
