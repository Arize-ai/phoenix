import {
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { graphql, useLazyLoadQuery, useQueryLoader } from "react-relay";
import { Outlet, useNavigate, useParams } from "react-router";
import { css } from "@emotion/react";

import {
  Flex,
  LazyTabPanel,
  Loading,
  Tab,
  TabList,
  Tabs,
} from "@phoenix/components";
import {
  ConnectedLastNTimeRangePicker,
  useTimeRange,
} from "@phoenix/components/datetime";
import { useProjectContext } from "@phoenix/contexts/ProjectContext";
import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";

import { ProjectPageQueriesProjectConfigQuery as ProjectPageProjectConfigQueryType } from "./__generated__/ProjectPageQueriesProjectConfigQuery.graphql";
import { ProjectPageQueriesSessionsQuery as ProjectPageSessionsQueryType } from "./__generated__/ProjectPageQueriesSessionsQuery.graphql";
import { ProjectPageQueriesSpansQuery as ProjectPageSpansQueryType } from "./__generated__/ProjectPageQueriesSpansQuery.graphql";
import { ProjectPageQueriesTracesQuery as ProjectPageTracesQueryType } from "./__generated__/ProjectPageQueriesTracesQuery.graphql";
import { ProjectPageQuery as ProjectPageQueryType } from "./__generated__/ProjectPageQuery.graphql";
import { ProjectPageHeader } from "./ProjectPageHeader";
import {
  ProjectPageQueriesProjectConfigQuery,
  ProjectPageQueriesSessionsQuery,
  ProjectPageQueriesSpansQuery,
  ProjectPageQueriesTracesQuery,
  ProjectPageQueryReferenceContext,
} from "./ProjectPageQueries";
import { StreamToggle } from "./StreamToggle";

const mainCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  .ac-tabs {
    flex: 1 1 auto;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    div[role="tablist"] {
      flex: none;
    }
    .ac-tabs__pane-container {
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
  const { timeRange } = useTimeRange();
  return (
    <Suspense fallback={<Loading />}>
      <ProjectPageContent
        projectId={projectId as string}
        timeRange={timeRange}
      />
    </Suspense>
  );
}

const TABS = ["spans", "traces", "sessions", "config"] as const;

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
  config: 3,
};

export function ProjectPageContent({
  projectId,
  timeRange,
}: {
  projectId: string;
  timeRange: OpenTimeRange;
}) {
  const treatOrphansAsRoots = useProjectContext(
    (state) => state.treatOrphansAsRoots
  );
  const timeRangeVariable = useMemo(() => {
    return {
      start: timeRange?.start?.toISOString(),
      end: timeRange?.end?.toISOString(),
    };
  }, [timeRange]);
  const navigate = useNavigate();
  const { rootPath, tab } = useProjectRootPath();
  const data = useLazyLoadQuery<ProjectPageQueryType>(
    graphql`
      query ProjectPageQuery($id: ID!, $timeRange: TimeRange!) {
        project: node(id: $id) {
          ...ProjectPageHeader_stats
          ...StreamToggle_data
        }
      }
    `,
    {
      id: projectId as string,
      timeRange: timeRangeVariable,
    },
    {
      fetchPolicy: "store-and-network",
      fetchKey: `${projectId}-${timeRangeVariable.start}-${timeRangeVariable.end}`,
    }
  );
  const [tracesQueryReference, loadTracesQuery, disposeTracesQuery] =
    useQueryLoader<ProjectPageTracesQueryType>(ProjectPageQueriesTracesQuery);
  const [spansQueryReference, loadSpansQuery, disposeSpansQuery] =
    useQueryLoader<ProjectPageSpansQueryType>(ProjectPageQueriesSpansQuery);
  const [sessionsQueryReference, loadSessionsQuery, disposeSessionsQuery] =
    useQueryLoader<ProjectPageSessionsQueryType>(
      ProjectPageQueriesSessionsQuery
    );
  const [
    projectConfigQueryReference,
    loadProjectConfigQuery,
    disposeProjectConfigQuery,
  ] = useQueryLoader<ProjectPageProjectConfigQueryType>(
    ProjectPageQueriesProjectConfigQuery
  );
  const tabIndex = isTab(tab) ? TAB_INDEX_MAP[tab] : 0;
  useEffect(() => {
    if (tabIndex === 0) {
      loadSpansQuery({
        id: projectId as string,
        timeRange: timeRangeVariable,
        orphanSpanAsRootSpan: treatOrphansAsRoots,
      });
    } else if (tabIndex === 1) {
      loadTracesQuery({
        id: projectId as string,
        timeRange: timeRangeVariable,
      });
    } else if (tabIndex === 2) {
      loadSessionsQuery({
        id: projectId as string,
        timeRange: timeRangeVariable,
      });
    } else if (tabIndex === 3) {
      loadProjectConfigQuery({
        id: projectId as string,
      });
    }

    return () => {
      disposeSpansQuery();
      disposeSessionsQuery();
      disposeTracesQuery();
      disposeProjectConfigQuery();
    };
  }, [
    loadTracesQuery,
    projectId,
    timeRangeVariable,
    tabIndex,
    disposeSpansQuery,
    disposeSessionsQuery,
    disposeTracesQuery,
    loadSpansQuery,
    loadSessionsQuery,
    loadProjectConfigQuery,
    disposeProjectConfigQuery,
    treatOrphansAsRoots,
  ]);

  const onTabChange = useCallback(
    (index: number) => {
      startTransition(() => {
        if (index === 1) {
          // navigate to the traces tab
          navigate(`${rootPath}/traces`);
        } else if (index === 2) {
          // navigate to the sessions tab
          navigate(`${rootPath}/sessions`);
        } else if (index === 3) {
          // navigate to the config tab
          navigate(`${rootPath}/config`);
        } else {
          // navigate to the spans tab
          navigate(`${rootPath}/spans`);
        }
      });
    },
    [navigate, rootPath]
  );

  return (
    <StreamStateProvider>
      <main css={mainCSS}>
        <ProjectPageHeader
          project={data.project}
          extra={
            <Flex direction="row" alignItems="center" gap="size-100">
              <StreamToggle project={data.project} />
              <ConnectedLastNTimeRangePicker />
            </Flex>
          }
        />
        <ProjectPageQueryReferenceContext.Provider
          value={{
            spansQueryReference: spansQueryReference ?? null,
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
            <LazyTabPanel padded={false} id="config">
              <Outlet />
            </LazyTabPanel>
          </Tabs>
        </ProjectPageQueryReferenceContext.Provider>
      </main>
    </StreamStateProvider>
  );
}
