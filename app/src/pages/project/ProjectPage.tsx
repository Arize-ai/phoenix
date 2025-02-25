import React, { Suspense, useCallback, useMemo } from "react";
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
import { ProjectPageQuery } from "./__generated__/ProjectPageQuery.graphql";
import { ProjectPageHeader } from "./ProjectPageHeader";
import {
  ProjectPageQueriesSessionsQuery,
  ProjectPageQueriesSpansQuery,
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

const TAB_INDEX_MAP: Record<string, number> = {
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
  const data = useLazyLoadQuery<ProjectPageQuery>(
    graphql`
      query ProjectPageQuery($id: GlobalID!, $timeRange: TimeRange!) {
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
  const [spansQueryReference, loadSpansQuery, disposeSpansQuery] =
    useQueryLoader<ProjectPageSpansQueryType>(ProjectPageQueriesSpansQuery);
  const [sessionsQueryReference, loadSessionsQuery, disposeSessionsQuery] =
    useQueryLoader<ProjectPageSessionsQueryType>(
      ProjectPageQueriesSessionsQuery
    );
  const onTabChange = useCallback(
    (index: number) => {
      if (index === 1) {
        disposeSessionsQuery();
        loadSpansQuery({
          id: projectId as string,
          timeRange: timeRangeVariable,
        });
        // navigate to the spans tab
        navigate(`${rootPath}/spans`);
      } else if (index === 2) {
        disposeSpansQuery();
        loadSessionsQuery({
          id: projectId as string,
          timeRange: timeRangeVariable,
        });
        // navigate to the sessions tab
        navigate(`${rootPath}/sessions`);
      } else {
        disposeSpansQuery();
        disposeSessionsQuery();
        // navigate to the traces tab
        navigate(`${rootPath}/traces`);
      }
    },
    [
      disposeSpansQuery,
      loadSpansQuery,
      disposeSessionsQuery,
      loadSessionsQuery,
      navigate,
      rootPath,
      timeRangeVariable,
      projectId,
    ]
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
          }}
        >
          <Tabs onChange={onTabChange} index={TAB_INDEX_MAP?.[tab] ?? 0}>
            <TabPane name="Traces">
              <Outlet />
            </TabPane>
            <TabPane name="Spans">
              <Outlet />
            </TabPane>
            <TabPane name="Sessions">
              <Outlet />
            </TabPane>
          </Tabs>
        </ProjectPageQueryReferenceContext.Provider>
      </main>
    </StreamStateProvider>
  );
}
