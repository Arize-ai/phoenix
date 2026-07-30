import { css } from "@emotion/react";
import {
  startTransition,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
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
import {
  type SettledSpanFilterSeed,
  spanFilterSeed,
  type SpanFilterSeed,
} from "./spanFilterSeed";

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
  const [tracesFilterSeed, setTracesFilterSeed] =
    useState<SettledSpanFilterSeed | null>(null);
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
  const [searchParams, setSearchParams] = useSearchParams();
  // Read at load time rather than depended on, so a live window sliding
  // forward does not reload the preload -- see the note on the tab loader.
  const timeRangeRef = useRef(timeRangeISOStrings);
  useEffect(() => {
    timeRangeRef.current = timeRangeISOStrings;
  }, [timeRangeISOStrings]);

  /**
   * Load the spans table from a condition whose validity and root scope are
   * both settled. Called for the conditions this app classifies itself, and by
   * `ProjectSpansPage` once the field has validated one it cannot.
   *
   * `persistToUrl` is false when the seed is a fallback rather than what was
   * asked for. The URL then keeps the rejected text so it stays visible and
   * editable, and the field goes on reporting why it failed.
   */
  const resolveSpansSeed = useCallback(
    (seed: SettledSpanFilterSeed, persistToUrl = true) => {
      startTransition(() => {
        setSpansFilterSeedState((previous) => ({
          seed,
          version: (previous?.version ?? 0) + 1,
        }));
        // Before the version bump re-keys `SpanFiltersProvider` and it re-reads
        // the URL, or a condition typed while waiting loses to the stale one
        // still in the address bar. Written even when empty: an absent param
        // seeds the default, an empty one means deliberately cleared.
        if (persistToUrl) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.set(SPAN_FILTER_CONDITION_PARAM, seed.condition);
              return next;
            },
            { replace: true }
          );
        }
        loadSpansQuery({
          id: projectId,
          timeRange: timeRangeRef.current,
          filterCondition: seed.condition || null,
          rootSpansOnly: seed.rootSpansOnly,
          first: DEFAULT_PAGE_SIZE,
        });
      });
    },
    [projectId, loadSpansQuery, setSearchParams]
  );

  // Load the preloaded query backing the active tab's table. The time range is
  // read at load time (via an effect event, so it is not a reactive trigger)
  // rather than tracked as a dependency: live "last-N" windows slide forward on
  // a timer. Reloading a parent on every slide could replace the live
  // connection with stale rows (see issue #14216). The tables instead own
  // time-range and filter liveness through their own `refetch`; parent preloads
  // need only an initial window and reload solely on project or tab changes.
  /** As `resolveSpansSeed`, for the traces tab. */
  const resolveTracesSeed = useCallback(
    (seed: SettledSpanFilterSeed, persistToUrl = true) => {
      startTransition(() => {
        setTracesFilterSeed(seed);
        if (persistToUrl) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.set(SPAN_FILTER_CONDITION_PARAM, seed.condition);
              return next;
            },
            { replace: true }
          );
        }
        loadTracesQuery({
          id: projectId,
          timeRange: timeRangeRef.current,
          filterCondition: seed.condition || null,
        });
      });
    },
    [projectId, loadTracesQuery, setSearchParams]
  );

  const loadTableQueryForTab = useEffectEvent(
    (currentTabIndex: number, currentProjectId: string) => {
      if (currentTabIndex === TAB_INDEX_MAP.spans) {
        // A seed this app can classify loads now. Anything else needs the
        // server, and asking needs the filter field, which `ProjectSpansPage`
        // mounts on its own while this stays null. Nothing is fetched until
        // the condition is known good.
        const seed = spanFilterSeed(
          searchParams.get(SPAN_FILTER_CONDITION_PARAM) ??
            DEFAULT_SPAN_FILTER_CONDITION
        );
        if (seed.requiresServerValidation) {
          setSpansFilterSeedState(null);
        } else {
          resolveSpansSeed(seed);
        }
      } else if (currentTabIndex === TAB_INDEX_MAP.traces) {
        const seed = spanFilterSeed(
          searchParams.get(SPAN_FILTER_CONDITION_PARAM) ?? ""
        );
        if (seed.requiresServerValidation) {
          setTracesFilterSeed(null);
        } else {
          resolveTracesSeed(seed);
        }
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
          resolveSpansSeed,
          sessionsQueryReference: sessionsQueryReference ?? null,
          tracesQueryReference: tracesQueryReference ?? null,
          tracesFilterSeed,
          resolveTracesSeed,
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
