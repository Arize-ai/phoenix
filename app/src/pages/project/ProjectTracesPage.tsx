import React, { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Outlet, useParams } from "react-router";

import { useTimeRange } from "@phoenix/components/datetime/TimeRangeContext";
import { ProjectTracesPageQuery } from "@phoenix/pages/project/__generated__/ProjectTracesPageQuery.graphql";
import { SpanFilterConditionProvider } from "@phoenix/pages/project/SpanFilterConditionContext";
import { TracesTable } from "@phoenix/pages/project/TracesTable";
import { TracingRoot } from "@phoenix/pages/TracingRoot";

export const ProjectTracesPage = () => {
  const { projectId } = useParams();
  const { timeRange } = useTimeRange();
  const timeRangeVariable = useMemo(() => {
    return {
      start: timeRange?.start?.toISOString(),
      end: timeRange?.end?.toISOString(),
    };
  }, [timeRange]);
  if (!projectId) {
    throw new Error("projectId is required");
  }
  const data = useLazyLoadQuery<ProjectTracesPageQuery>(
    graphql`
      query ProjectTracesPageQuery($id: GlobalID!, $timeRange: TimeRange!) {
        project: node(id: $id) {
          ...TracesTable_spans
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
    <TracingRoot>
      <SpanFilterConditionProvider>
        <Suspense>
          <TracesTable project={data.project} />
        </Suspense>
      </SpanFilterConditionProvider>
      <Suspense>
        <Outlet />
      </Suspense>
    </TracingRoot>
  );
};
