import { css } from "@emotion/react";
import {
  startTransition,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { graphql, useLazyLoadQuery, useQueryLoader } from "react-relay";
import {
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";

import { LazyTabPanel, Loading, Tab, TabList, Tabs } from "@phoenix/components";
import {
  ConnectedTimeRangeSelector,
  type TimeRangeISOStrings,
  useTimeRange,
} from "@phoenix/components/datetime";
import { TopNavActions } from "@phoenix/components/nav";
import { SPAN_FILTER_CONDITION_PARAM } from "@phoenix/constants/searchParams";
import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { clearSelectionScopedParams } from "@phoenix/utils/urlUtils";

import type { ProjectPageQueriesProjectConfigQuery as ProjectPageProjectConfigQueryType } from "./__generated__/ProjectPageQueriesProjectConfigQuery.graphql";
import type { ProjectPageQueriesSessionsQuery as ProjectPageSessionsQueryType } from "./__generated__/ProjectPageQueriesSessionsQuery.graphql";
import type { ProjectPageQueriesSpansQuery as ProjectPageSpansQueryType } from "./__generated__/ProjectPageQueriesSpansQuery.graphql";
import type { ProjectPageQueriesTracesQuery as ProjectPageTracesQueryType } from "./__generated__/ProjectPageQueriesTracesQuery.graphql";
import type { ProjectPageQuery as ProjectPageQueryType } from "./__generated__/ProjectPageQuery.graphql";
import { DEFAULT_PAGE_SIZE } from "./constants";
import {
  ProjectPageQueriesProjectConfigQuery,
  ProjectPageQueriesSessionsQuery,
  ProjectPageQueriesSpansQuery,
  ProjectPageQueriesTracesQuery,
  ProjectPageQueryReferenceContext,
} from "./ProjectPageQueries";
import { ProjectTimeRangeControls } from "./ProjectTimeRangeControls";
import { DEFAULT_SPAN_FILTER_CONDITION } from "./spanFilterRootScopeConstants";
import { spanFilterSeed, type SpanFilterSeed } from "./spanFilterSeed";

const mainCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  .tabs {
    flex: 1 1 auto;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    div[role="tablist"] {
      flex: none;
    }
    .tabs__pane-container {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      div[role="tabpanel"]:not([hidden]) {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
    }
  }
`;

export function ProjectPage() {
  const { projectId } = useParams();
  const { timeRangeISOStrings } = useTimeRange();
  const deferredTimeRangeISOStrings = useDeferredValue(timeRangeISOStrings);
  return (
    <>
      <TopNavActions>
        <ConnectedTimeRangeSelector size="S" />
      </TopNavActions>
      <Suspense fallback={<Loading />}>
        <ProjectPageContent
          key={projectId}
          projectId={projectId as string}
          timeRangeISOStrings={deferredTimeRangeISOStrings}
        />
      </Suspense>
    </>
  );
}

const TABS = ["spans", "traces", "sessions", "config", "metrics"] as const;

/**
 * Type guard for the tab path in the URL
 */
const isTab = (tab: string): tab is (typeof TABS)[number] => {
  return TABS.includes(tab as (typeof TABS)[number]);
};

const TAB_INDEX_MAP: Record<(typeof TABS)[number], number> = {
  spans: 0,
  traces: 1,
  sessions: 2,
  metrics: 3,
  config: 4,
};

const TAB_PATH_BY_INDEX = Object.fromEntries(
  Object.entries(TAB_INDEX_MAP).map(([tab, index]) => [index, tab])
) as Record<number, (typeof TABS)[number]>;

export function ProjectPageContent({
  projectId,
  timeRangeISOStrings,
}: {
  projectId: string;
  timeRangeISOStrings: TimeRangeISOStrings;
}) {
  return (
    <StreamStateProvider>
      <ProjectPageContentBody
        projectId={projectId}
        timeRangeISOStrings={timeRangeISOStrings}
      />
    </StreamStateProvider>
  );
}

function ProjectPageContentBody({
  projectId,
  timeRangeISOStrings,
}: {
  projectId: string;
  timeRangeISOStrings: TimeRangeISOStrings;
}) {
  const navigate = useNavigate();
  const { rootPath, tab } = useProjectRootPath();
  const data = useLazyLoadQuery<ProjectPageQueryType>(
    graphql`
      query ProjectPageQuery($id: ID!, $timeRange: TimeRange!) {
        project: node(id: $id) {
          ... on Project {
            ...ProjectStats_project
            ...ProjectTimeRangeControls_data
          }
        }
      }
    `,
    {
      id: projectId as string,
      timeRange: timeRangeISOStrings,
    },
    {
      fetchPolicy: "store-and-network",
      fetchKey: `${projectId}-${timeRangeISOStrings.start}-${timeRangeISOStrings.end}`,
    }
  );
  const [tracesQueryReference, loadTracesQuery] =
    useQueryLoader<ProjectPageTracesQueryType>(ProjectPageQueriesTracesQuery);
  const [spansQueryReference, loadSpansQuery] =
    useQueryLoader<ProjectPageSpansQueryType>(ProjectPageQueriesSpansQuery);
  const [spansFilterSeedState, setSpansFilterSeedState] = useState<{
    seed: SpanFilterSeed;
    version: number;
  } | null>(null);
  const [sessionsQueryReference, loadSessionsQuery] =
    useQueryLoader<ProjectPageSessionsQueryType>(
      ProjectPageQueriesSessionsQuery
    );
  const [projectConfigQueryReference, loadProjectConfigQuery] =
    useQueryLoader<ProjectPageProjectConfigQueryType>(
      ProjectPageQueriesProjectConfigQuery
    );
  const tabIndex = isTab(tab) ? TAB_INDEX_MAP[tab] : 0;
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Load the preloaded query backing the active tab's table. The time range is
  // read at load time (via an effect event, so it is not a reactive trigger)
  // rather than tracked as a dependency: live "last-N" windows slide forward on
  // a timer. The spans preload carries only its mount-time filter seed, which
  // can be older than the filter currently applied inside `SpansTable`.
  // Reloading that parent on every slide could therefore replace the live
  // connection with stale-seed rows (see issue #14216). The tables instead own
  // time-range and filter liveness through their own `refetch`; parent preloads
  // need only an initial window and reload solely on project or tab changes.
  const loadTableQueryForTab = useEffectEvent(
    (currentTabIndex: number, currentProjectId: string) => {
      if (currentTabIndex === TAB_INDEX_MAP.spans) {
        // Resolve one seed for both this preload and the table that consumes
        // it. A seed exempt from server validation is already in this payload
        // and needs no first fetch. A seed requiring validation is withheld
        // until the server accepts it: rows arrive unfiltered, and the table
        // waits rather than showing them.
        const seed = spanFilterSeed(
          searchParams.get(SPAN_FILTER_CONDITION_PARAM) ??
            DEFAULT_SPAN_FILTER_CONDITION
        );
        setSpansFilterSeedState((previous) => ({
          seed,
          version: (previous?.version ?? 0) + 1,
        }));
        loadSpansQuery({
          id: currentProjectId,
          timeRange: timeRangeISOStrings,
          filterCondition: seed.requiresServerValidation
            ? null
            : seed.condition || null,
          rootSpansOnly: seed.requiresServerValidation
            ? false
            : seed.rootSpansOnly,
          // Rows fetched for an unvalidated seed are never shown -- the table
          // waits and refetches once the server accepts the condition. Asking
          // for none skips the query, and with it a database connection.
          first: seed.requiresServerValidation ? 0 : DEFAULT_PAGE_SIZE,
        });
      } else if (currentTabIndex === TAB_INDEX_MAP.traces) {
        loadTracesQuery({
          id: currentProjectId,
          timeRange: timeRangeISOStrings,
        });
      } else if (currentTabIndex === TAB_INDEX_MAP.sessions) {
        loadSessionsQuery({
          id: currentProjectId,
          timeRange: timeRangeISOStrings,
        });
      } else if (currentTabIndex === TAB_INDEX_MAP.config) {
        loadProjectConfigQuery({
          id: currentProjectId,
        });
      }
    }
  );
  useEffect(() => {
    startTransition(() => {
      loadTableQueryForTab(tabIndex, projectId as string);
    });
  }, [tabIndex, projectId]);

  const onTabChange = useCallback(
    (index: number) => {
      startTransition(() => {
        const search = clearSelectionScopedParams(location.search);
        const tab = TAB_PATH_BY_INDEX[index] ?? "spans";
        navigate({
          pathname: `${rootPath}/${tab}`,
          search,
          hash: location.hash,
        });
      });
    },
    [location.hash, location.search, navigate, rootPath]
  );

  return (
    <main css={mainCSS}>
      <TopNavActions order={1}>
        <ProjectTimeRangeControls project={data.project} />
      </TopNavActions>
      <ProjectPageQueryReferenceContext.Provider
        value={{
          spansQueryReference: spansQueryReference ?? null,
          spansFilterSeed: spansFilterSeedState?.seed ?? null,
          spansFilterSeedVersion: spansFilterSeedState?.version ?? 0,
          sessionsQueryReference: sessionsQueryReference ?? null,
          tracesQueryReference: tracesQueryReference ?? null,
          projectConfigQueryReference: projectConfigQueryReference ?? null,
        }}
      >
        <Tabs
          onSelectionChange={(key) => {
            if (typeof key === "string" && isTab(key)) {
              onTabChange(TAB_INDEX_MAP[key]);
            }
          }}
          selectedKey={tab}
        >
          <TabList>
            <Tab id="spans">Spans</Tab>
            <Tab id="traces">Traces</Tab>
            <Tab id="sessions">Sessions</Tab>
            <Tab id="metrics">Metrics</Tab>
            <Tab id="config">Config</Tab>
          </TabList>
          <LazyTabPanel padded={false} id="spans">
            <Outlet />
          </LazyTabPanel>
          <LazyTabPanel padded={false} id="traces">
            <Outlet />
          </LazyTabPanel>
          <LazyTabPanel padded={false} id="sessions">
            <Outlet />
          </LazyTabPanel>
          <LazyTabPanel padded={false} id="metrics">
            <Outlet />
          </LazyTabPanel>
          <LazyTabPanel padded={false} id="config">
            <Outlet />
          </LazyTabPanel>
        </Tabs>
      </ProjectPageQueryReferenceContext.Provider>
    </main>
  );
}
