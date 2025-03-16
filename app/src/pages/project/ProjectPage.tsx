import React, {
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { graphql, useLazyLoadQuery, useQueryLoader } from "react-relay";
import { Outlet, useNavigate, useParams } from "react-router";
import { css } from "@emotion/react";

import { TabPane, Tabs } from "@arizeai/components";

import { Flex, Loading } from "@phoenix/components";
import {
  ConnectedLastNTimeRangePicker,
  useTimeRange,
} from "@phoenix/components/datetime";
import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";

import { ProjectPageQueriesSessionsQuery as ProjectPageSessionsQueryType } from "./__generated__/ProjectPageQueriesSessionsQuery.graphql";
import { ProjectPageQueriesSpansQuery as ProjectPageSpansQueryType } from "./__generated__/ProjectPageQueriesSpansQuery.graphql";
import { ProjectPageQueriesTracesQuery as ProjectPageTracesQueryType } from "./__generated__/ProjectPageQueriesTracesQuery.graphql";
import { ProjectPageQuery as ProjectPageQueryType } from "./__generated__/ProjectPageQuery.graphql";
import { ProjectPageHeader } from "./ProjectPageHeader";
import {
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

const TABS = ["traces", "spans", "sessions"] as const;
const isTab = (tab: string): tab is (typeof TABS)[number] => {
  return TABS.includes(tab as (typeof TABS)[number]);
};

const TAB_INDEX_MAP: Record<(typeof TABS)[number], number> = {
  traces: 0,
  spans: 1,
  sessions: 2,
};

export function ProjectPageContent({
  projectId,
  timeRange,
}: {
  projectId: string;
  timeRange: OpenTimeRange;
}) {
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
  const tabIndex = isTab(tab) ? TAB_INDEX_MAP[tab] : 0;
  useEffect(() => {
    if (tabIndex === 0) {
      loadTracesQuery({
        id: projectId as string,
        timeRange: timeRangeVariable,
      });
    } else if (tabIndex === 1) {
      loadSpansQuery({
        id: projectId as string,
        timeRange: timeRangeVariable,
      });
    } else if (tabIndex === 2) {
      loadSessionsQuery({
        id: projectId as string,
        timeRange: timeRangeVariable,
      });
    }

    return () => {
      disposeSpansQuery();
      disposeSessionsQuery();
      disposeTracesQuery();
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
  ]);

  const onTabChange = useCallback(
    (index: number) => {
      startTransition(() => {
        if (index === 1) {
          // navigate to the spans tab
          navigate(`${rootPath}/spans`);
        } else if (index === 2) {
          // navigate to the sessions tab
          navigate(`${rootPath}/sessions`);
        } else {
          // navigate to the traces tab
          navigate(`${rootPath}/traces`);
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
          }}
        >
          <Tabs onChange={onTabChange} index={tabIndex}>
            <TabPane name="Traces">
              {({ isSelected }) => {
                if (isSelected) {
                  return <Outlet />;
                }
                return null;
              }}
            </TabPane>
            <TabPane name="Spans">
              {({ isSelected }) => {
                if (isSelected) {
                  return <Outlet />;
                }
                return null;
              }}
            </TabPane>
            <TabPane name="Sessions">
              {({ isSelected }) => {
                if (isSelected) {
                  return <Outlet />;
                }
                return null;
              }}
            </TabPane>
          </Tabs>
        </ProjectPageQueryReferenceContext.Provider>
      </main>
    </StreamStateProvider>
  );
}
