import { useCallback, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { useTimeRange } from "@phoenix/components/datetime";
import { ErrorBoundary } from "@phoenix/components/exception";
import type { ErrorBoundaryFallbackProps } from "@phoenix/components/exception/types";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { ProjectProvider } from "@phoenix/contexts/ProjectContext";
import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";
import { TracingProvider } from "@phoenix/contexts/TracingContext";
import type { ProjectEvaluatorTracesQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorTracesQuery.graphql";
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

type ProjectEvaluatorTracesProps = {
  /** The evaluator's own trace project. */
  projectId: string;
  projectEvaluatorId: string;
  /** Whether any run is on record, choosing which empty state to show. */
  hasEverRun: boolean;
};

/**
 * One evaluator's own traces: what it read, the model call it made, and the
 * judgment it parsed out. Each evaluator writes into its own trace project,
 * and the evaluator's id is still passed to the server as a scope, so the
 * rows here are always this evaluator's.
 */
export function ProjectEvaluatorTraces(props: ProjectEvaluatorTracesProps) {
  // Reset the mount-time filter and time-range seed when the tab is reused for
  // a different evaluator.
  return (
    <ProjectEvaluatorTracesContent key={props.projectEvaluatorId} {...props} />
  );
}

function ProjectEvaluatorTracesContent({
  projectId,
  projectEvaluatorId,
  hasEverRun,
}: ProjectEvaluatorTracesProps) {
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
                <ProjectEvaluatorTracesTable
                  projectId={projectId}
                  projectEvaluatorId={projectEvaluatorId}
                  hasEverRun={hasEverRun}
                  seed={seed}
                />
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

function ProjectEvaluatorTracesTable({
  projectId,
  projectEvaluatorId,
  hasEverRun,
  seed,
}: ProjectEvaluatorTracesProps & { seed: SettledSpanFilterSeed }) {
  const { timeRangeISOStrings } = useTimeRange();
  // The table owns time-range liveness through its filtered refetch. Holding
  // the parent query to its mount-time window prevents a competing parent
  // response from replacing a custom-filter connection when the range moves.
  const [initialTimeRangeISOStrings] = useState(() => timeRangeISOStrings);
  const data = useLazyLoadQuery<ProjectEvaluatorTracesQuery>(
    graphql`
      query ProjectEvaluatorTracesQuery(
        $id: ID!
        $timeRange: TimeRange!
        $filterCondition: String
        $rootSpansOnly: Boolean!
        $projectEvaluatorId: ID!
      ) {
        project: node(id: $id) {
          ... on Project {
            ...SpansTable_spans
              @arguments(
                filterCondition: $filterCondition
                rootSpansOnly: $rootSpansOnly
                projectEvaluatorId: $projectEvaluatorId
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
      projectEvaluatorId,
    },
    {
      fetchPolicy: "store-and-network",
      fetchKey: projectEvaluatorId,
    }
  );
  return (
    <SpansTable
      project={data.project}
      seed={seed}
      projectEvaluatorId={projectEvaluatorId}
      emptyState={<ProjectEvaluatorTracesEmpty hasEverRun={hasEverRun} />}
    />
  );
}

/**
 * An evaluator that has never run and one whose past runs left no trace here
 * are different situations with different remedies, so they get different copy.
 */
function ProjectEvaluatorTracesEmpty({ hasEverRun }: { hasEverRun: boolean }) {
  if (!hasEverRun) {
    return (
      <TableEmptyWrap>
        <EmptyState
          graphic={<EmptyStateGraphic variant="trace" />}
          title="This evaluator has not run yet"
          description="Traces appear here once the evaluator runs. It runs on its own against the spans its scope selects — there is nothing to start."
        />
      </TableEmptyWrap>
    );
  }
  return (
    <TableEmptyWrap>
      <EmptyState
        graphic={<EmptyStateGraphic variant="trace" />}
        title="No traces to show"
        description="No traces from this evaluator match the selected time range and filters. Evaluations that ran before evaluator tracing was added did not produce one."
      />
    </TableEmptyWrap>
  );
}
