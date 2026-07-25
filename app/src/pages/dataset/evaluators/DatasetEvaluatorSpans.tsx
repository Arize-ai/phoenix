import { graphql, useLazyLoadQuery } from "react-relay";

import { useTimeRange } from "@phoenix/components/datetime";
import { ProjectProvider } from "@phoenix/contexts/ProjectContext";
import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";
import { TracingProvider } from "@phoenix/contexts/TracingContext";
import type { DatasetEvaluatorSpansQuery } from "@phoenix/pages/dataset/evaluators/__generated__/DatasetEvaluatorSpansQuery.graphql";
import { ORPHAN_AWARE_ROOT_SPANS_CONDITION } from "@phoenix/pages/project/spanFilterRootScope";
import { SpanFiltersProvider } from "@phoenix/pages/project/SpanFiltersContext";
import { SpansTable } from "@phoenix/pages/project/SpansTable";

export function DatasetEvaluatorSpans({ projectId }: { projectId: string }) {
  const { timeRangeISOStrings } = useTimeRange();
  const data = useLazyLoadQuery<DatasetEvaluatorSpansQuery>(
    graphql`
      query DatasetEvaluatorSpansQuery($id: ID!, $timeRange: TimeRange!) {
        project: node(id: $id) {
          ... on Project {
            ...SpansTable_spans
          }
        }
      }
    `,
    {
      id: projectId,
      timeRange: timeRangeISOStrings,
    },
    {
      fetchPolicy: "store-and-network",
      fetchKey: `${projectId}-${timeRangeISOStrings.start}-${timeRangeISOStrings.end}`,
    }
  );
  return (
    <ProjectProvider projectId={projectId}>
      <StreamStateProvider>
        <TracingProvider projectId={projectId} tableId="spans">
          {/* Orphan-aware roots, matching the `orphanSpanAsRootSpan: true`
              this view used before root scoping moved into the DSL. */}
          <SpanFiltersProvider
            defaultFilterCondition={ORPHAN_AWARE_ROOT_SPANS_CONDITION}
          >
            <SpansTable project={data.project} />
          </SpanFiltersProvider>
        </TracingProvider>
      </StreamStateProvider>
    </ProjectProvider>
  );
}
