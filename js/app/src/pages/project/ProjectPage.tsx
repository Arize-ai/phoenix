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
import {
  ProjectPageQueriesProjectConfigQuery,
  ProjectPageQueriesSessionsQuery,
  ProjectPageQueriesSpansQuery,
  ProjectPageQueriesTracesQuery,
  ProjectPageQueryReferenceContext,
} from "./ProjectPageQueries";
import { ProjectTimeRangeControls } from "./ProjectTimeRangeControls";
import { DEFAULT_SPAN_FILTER_CONDITION } from "./spanFilterRootScopeConstants";
import { type SettledSpanFilterSeed, spanFilterSeed } from "./spanFilterSeed";

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

/** Whether the URL already carries this condition. */
function urlAlreadyHasCondition(condition: string): boolean {
  return (
    new URLSearchParams(window.location.search).get(
      SPAN_FILTER_CONDITION_PARAM
    ) === condition
  );
}

/**
 * The URL's condition when it needs no server answer, else null.
 *
 * Reads `location` rather than taking the search string, so the `useState`
 * initializers below close over nothing local. The React Compiler hoists those
 * initializers out of the component, and a captured local does not survive it.
 */
function settledSeedFromUrl(fallback: string): SettledSpanFilterSeed | null {
  const seed = spanFilterSeed(
    new URLSearchParams(window.location.search).get(
      SPAN_FILTER_CONDITION_PARAM
    ) ?? fallback
  );
  return seed.requiresServerValidation ? null : seed;
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
  // Classified during the first render, not in the effect that follows it.
  // A condition needing no server answer must never leave the page in the
  // pending state, or the filter field mounts standalone for a frame and then
  // moves into the table.
  const [spansFilterSeed, setSpansFilterSeed] =
    useState<SettledSpanFilterSeed | null>(() =>
      settledSeedFromUrl(DEFAULT_SPAN_FILTER_CONDITION)
    );
  const [tracesFilterSeed, setTracesFilterSeed] =
    useState<SettledSpanFilterSeed | null>(() => settledSeedFromUrl(""));
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
  // React Router recreates this setter on every location change. The resolvers
  // below are handed to the filter field, whose validation effect keys on their
  // identity -- depending on the setter directly would revalidate on every URL
  // write, and each pass would load and dispose another query.
  const setSearchParamsRef = useRef(setSearchParams);
  useEffect(() => {
    setSearchParamsRef.current = setSearchParams;
  }, [setSearchParams]);
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
   * `persistToUrl` is false whenever the seed is not something the user asked
   * for -- a fallback after validation failed, or this tab's own default when
   * the URL named no condition. A fallback leaves the rejected text in the URL
   * so it stays visible and editable while the field reports why it failed; a
   * default is left out entirely, so the other tab does not inherit it.
   */
  const resolveSpansSeed = useCallback(
    (seed: SettledSpanFilterSeed, persistToUrl = true) => {
      startTransition(() => {
        setSpansFilterSeed(seed);
        // Before the new condition re-keys `SpanFiltersProvider` and it re-reads
        // the URL, or a condition typed while waiting loses to the stale one
        // still in the address bar. An empty condition is as writable as any
        // other -- a present-but-empty param means deliberately cleared, while
        // an absent one seeds the tab's default -- though when it arrived from
        // the URL the already-has-it check makes the write a no-op.
        if (persistToUrl && !urlAlreadyHasCondition(seed.condition)) {
          setSearchParamsRef.current(
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
        });
      });
    },
    [projectId, loadSpansQuery]
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
        if (persistToUrl && !urlAlreadyHasCondition(seed.condition)) {
          setSearchParamsRef.current(
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
    [projectId, loadTracesQuery]
  );

  const loadTableQueryForTab = useEffectEvent(
    (currentTabIndex: number, currentProjectId: string) => {
      if (currentTabIndex === TAB_INDEX_MAP.spans) {
        // A seed this app can classify loads now. Anything else needs the
        // server, and asking needs the filter field, which `ProjectSpansPage`
        // mounts on its own while this stays null. Nothing is fetched until
        // the condition is known good.
        const fromUrl = searchParams.get(SPAN_FILTER_CONDITION_PARAM);
        const seed = spanFilterSeed(fromUrl ?? DEFAULT_SPAN_FILTER_CONDITION);
        // Returning to a tab whose rows already answer this condition is not a
        // reason to reload it. Re-resolving would tear the table down and
        // rebuild it for the same result.
        if (
          spansQueryReference &&
          spansFilterSeed?.condition === seed.condition
        ) {
          return;
        }
        if (seed.requiresServerValidation) {
          setSpansFilterSeed(null);
        } else {
          // Persist only a condition the URL already carried. The two tabs
          // share one param but default differently -- spans to root spans,
          // traces to every span -- so writing a tab's own default would
          // impose it on the other one at the next tab switch.
          resolveSpansSeed(seed, fromUrl !== null);
        }
      } else if (currentTabIndex === TAB_INDEX_MAP.traces) {
        const fromUrl = searchParams.get(SPAN_FILTER_CONDITION_PARAM);
        const seed = spanFilterSeed(fromUrl ?? "");
        if (
          tracesQueryReference &&
          tracesFilterSeed?.condition === seed.condition
        ) {
          return;
        }
        if (seed.requiresServerValidation) {
          setTracesFilterSeed(null);
        } else {
          resolveTracesSeed(seed, fromUrl !== null);
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
          spansFilterSeed,
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
