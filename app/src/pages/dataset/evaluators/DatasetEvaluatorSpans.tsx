import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Loading } from "@phoenix/components";
import { useTimeRange } from "@phoenix/components/datetime";
import { ProjectProvider } from "@phoenix/contexts/ProjectContext";
import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";
import { TracingProvider } from "@phoenix/contexts/TracingContext";
import type { DatasetEvaluatorSpansQuery } from "@phoenix/pages/dataset/evaluators/__generated__/DatasetEvaluatorSpansQuery.graphql";
import { SpanFiltersProvider } from "@phoenix/pages/project/SpanFiltersContext";
import { SpansTable } from "@phoenix/pages/project/SpansTable";

export function DatasetEvaluatorSpans({ projectId }: { projectId: string }) {
  return (
    <ProjectProvider projectId={projectId}>
      <StreamStateProvider>
        <TracingProvider projectId={projectId} tableId="spans">
          <SpanFiltersProvider>
            <Suspense fallback={<Loading />}>
              <DatasetEvaluatorSpansContent projectId={projectId} />
            </Suspense>
          </SpanFiltersProvider>
        </TracingProvider>
      </StreamStateProvider>
    </ProjectProvider>
  );
}

function DatasetEvaluatorSpansContent({ projectId }: { projectId: string }) {
  const { timeRange } = useTimeRange();
  const timeRangeVariable = useMemo(
    () => ({
      start: timeRange?.start?.toISOString(),
      end: timeRange?.end?.toISOString(),
    }),
    [timeRange]
  );
  const data = useLazyLoadQuery<DatasetEvaluatorSpansQuery>(
    graphql`
      query DatasetEvaluatorSpansQuery(
        $id: ID!
        $timeRange: TimeRange!
        $orphanSpanAsRootSpan: Boolean!
      ) {
        project: node(id: $id) {
          ... on Project {
            ...SpansTable_spans
          }
        }
      }
    `,
    {
      id: projectId,
      timeRange: timeRangeVariable,
      orphanSpanAsRootSpan: true,
    },
    {
      fetchPolicy: "store-and-network",
      fetchKey: `${projectId}-${timeRangeVariable.start}-${timeRangeVariable.end}`,
    }
  );
  return <SpansTable project={data.project} />;
}
