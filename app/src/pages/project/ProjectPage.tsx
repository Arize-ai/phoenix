import React, { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
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
import { ProjectPageHeader } from "./ProjectPageHeader";
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
          ...SpansTable_spans
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
      <Tabs>
        <TabPane name="Traces">
          {({ isSelected }) => {
            return (
              isSelected && (
                <Suspense>
                  <TracesTable project={data.project} />
                </Suspense>
              )
            );
          }}
        </TabPane>
        <TabPane name="Spans" title="Spans">
          {({ isSelected }) => {
            return (
              isSelected && (
                <Suspense>
                  <SpansTable project={data.project} />
                </Suspense>
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
