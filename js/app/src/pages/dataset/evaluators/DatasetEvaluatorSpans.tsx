import { useCallback, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { useTimeRange } from "@phoenix/components/datetime";
import { ErrorBoundary } from "@phoenix/components/exception";
import type { ErrorBoundaryFallbackProps } from "@phoenix/components/exception/types";
import { ProjectProvider } from "@phoenix/contexts/ProjectContext";
import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";
import { TracingProvider } from "@phoenix/contexts/TracingContext";
import type { DatasetEvaluatorSpansQuery } from "@phoenix/pages/dataset/evaluators/__generated__/DatasetEvaluatorSpansQuery.graphql";
import { PendingSpanFilter } from "@phoenix/pages/project/PendingSpanFilter";
import { SpanFilterErrorFallback } from "@phoenix/pages/project/SpanFilterErrorFallback";
import { STRICT_ROOT_SPANS_CONDITION } from "@phoenix/pages/project/spanFilterRootScopeConstants";
import {
  SpanFiltersProvider,
  useInitialSpanFilterCondition,
} from "@phoenix/pages/project/SpanFiltersContext";
import {
  type SettledSpanFilterSeed,
  spanFilterSeed,
} from "@phoenix/pages/project/spanFilterSeed";
import { SpansTable } from "@phoenix/pages/project/SpansTable";

export function DatasetEvaluatorSpans({ projectId }: { projectId: string }) {
  // Reset the mount-time filter and time-range seed if this component is reused
  // for a different project.
  return <DatasetEvaluatorSpansContent key={projectId} projectId={projectId} />;
}

function DatasetEvaluatorSpansContent({ projectId }: { projectId: string }) {
  // Read once at mount. The table writes each applied filter back to the URL,
  // and deriving the variables from the live param would re-execute the query
  // below on every such write.
  const initialFilterCondition = useInitialSpanFilterCondition(
    STRICT_ROOT_SPANS_CONDITION
  );
  // A condition this app can classify loads straight away. Anything else waits
  // for the field to validate it, so no query is issued that would have to be
  // thrown away and no unfiltered rows are ever rendered.
  const [seed, setSeed] = useState<SettledSpanFilterSeed | null>(() => {
    const classified = spanFilterSeed(initialFilterCondition);
    return classified.requiresServerValidation ? null : classified;
  });
  // Stable identity: an inline fallback would remount the field on every render.
  const errorFallback = useCallback(
    ({ error }: ErrorBoundaryFallbackProps) => (
      <SpanFilterErrorFallback error={error} onResolved={setSeed} />
    ),
    []
  );
  return (
    <ProjectProvider projectId={projectId}>
      <StreamStateProvider>
        <TracingProvider projectId={projectId} tableId="spans">
          <SpanFiltersProvider
            key={seed ? seed.condition : "pending"}
            fallbackFilterCondition={seed?.condition ?? initialFilterCondition}
          >
            {/* Inside the provider so a resolved seed -- a new `key` -- remounts it. */}
            <ErrorBoundary fallback={errorFallback}>
              {seed ? (
                <DatasetEvaluatorSpansTable projectId={projectId} seed={seed} />
              ) : (
                <PendingSpanFilter onResolved={setSeed} />
              )}
            </ErrorBoundary>
          </SpanFiltersProvider>
        </TracingProvider>
      </StreamStateProvider>
    </ProjectProvider>
  );
}

function DatasetEvaluatorSpansTable({
  projectId,
  seed,
}: {
  projectId: string;
  seed: SettledSpanFilterSeed;
}) {
  const { timeRangeISOStrings } = useTimeRange();
  // The table owns time-range liveness through its filtered refetch. Holding
  // the parent query to its mount-time window prevents a competing parent
  // response from replacing a custom-filter connection when the range moves.
  const [initialTimeRangeISOStrings] = useState(() => timeRangeISOStrings);
  const data = useLazyLoadQuery<DatasetEvaluatorSpansQuery>(
    graphql`
      query DatasetEvaluatorSpansQuery(
        $id: ID!
        $timeRange: TimeRange!
        $filterCondition: String
        $rootSpansOnly: Boolean!
      ) {
        project: node(id: $id) {
          ... on Project {
            ...SpansTable_spans
              @arguments(
                filterCondition: $filterCondition
                rootSpansOnly: $rootSpansOnly
              )
          }
        }
      }
    `,
    {
      id: projectId,
      timeRange: initialTimeRangeISOStrings,
      filterCondition: seed.condition || null,
      rootSpansOnly: seed.rootSpansOnly,
    },
    {
      fetchPolicy: "store-and-network",
      fetchKey: projectId,
    }
  );
  return <SpansTable project={data.project} seed={seed} />;
}
