import React, { Suspense, useCallback, useMemo } from "react";
import {
  graphql,
  PreloadedQuery,
  useLazyLoadQuery,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";
import { Outlet } from "react-router";
import { useParams } from "react-router";
import { css } from "@emotion/react";

import { Flex, TabPane, Tabs } from "@arizeai/components";

import { Loading } from "@phoenix/components";
import {
  ConnectedLastNTimeRangePicker,
  useLastNTimeRange,
} from "@phoenix/components/datetime";

import { ProjectPageQuery } from "./__generated__/ProjectPageQuery.graphql";
import { ProjectPageSpansQuery as ProjectPageSpansQueryType } from "./__generated__/ProjectPageSpansQuery.graphql";
import { ProjectPageHeader } from "./ProjectPageHeader";
import { SpanFilterConditionProvider } from "./SpanFilterConditionContext";
import { SpansTable } from "./SpansTable";
import { StreamToggle } from "./StreamToggle";
import { TracesTable } from "./TracesTable";

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
  const { timeRange } = useLastNTimeRange();
  return (
    <Suspense fallback={<Loading />}>
      <ProjectPageContent
        projectId={projectId as string}
        timeRange={timeRange}
      />
    </Suspense>
  );
}

const ProjectPageSpansQuery = graphql`
  query ProjectPageSpansQuery($id: GlobalID!, $timeRange: TimeRange!) {
    project: node(id: $id) {
      ...SpansTable_spans
    }
  }
`;

export function ProjectPageContent({
  projectId,
  timeRange,
}: {
  projectId: string;
  timeRange: TimeRange;
}) {
  const timeRangeVariable = useMemo(() => {
    return {
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString(),
    };
  }, [timeRange]);

  const data = useLazyLoadQuery<ProjectPageQuery>(
    graphql`
      query ProjectPageQuery($id: GlobalID!, $timeRange: TimeRange!) {
        project: node(id: $id) {
          ...TracesTable_spans
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
    }
  );
  const [spansQueryReference, loadSpansQuery, disposeSpansQuery] =
    useQueryLoader<ProjectPageSpansQueryType>(ProjectPageSpansQuery);
  const onTabChange = useCallback(
    (index: number) => {
      if (index === 1) {
        loadSpansQuery({
          id: projectId as string,
          timeRange: timeRangeVariable,
        });
      } else {
        disposeSpansQuery();
      }
    },
    [disposeSpansQuery, loadSpansQuery, projectId, timeRangeVariable]
  );
  return (
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
      <Tabs onChange={onTabChange}>
        <TabPane name="Traces">
          {({ isSelected }) => {
            return (
              isSelected && (
                <SpanFilterConditionProvider>
                  <Suspense>
                    <TracesTable project={data.project} />
                  </Suspense>
                </SpanFilterConditionProvider>
              )
            );
          }}
        </TabPane>
        <TabPane name="Spans" title="Spans">
          {({ isSelected }) => {
            return (
              isSelected &&
              spansQueryReference && (
                <SpanFilterConditionProvider>
                  <Suspense fallback={<Loading />}>
                    <SpansTabContent queryReference={spansQueryReference} />
                  </Suspense>
                </SpanFilterConditionProvider>
              )
            );
          }}
        </TabPane>
      </Tabs>
      <Suspense>
        <Outlet />
      </Suspense>
    </main>
  );
}

function SpansTabContent({
  queryReference,
}: {
  queryReference: PreloadedQuery<ProjectPageSpansQueryType>;
}) {
  const data = usePreloadedQuery(ProjectPageSpansQuery, queryReference);
  return <SpansTable project={data.project} />;
}
