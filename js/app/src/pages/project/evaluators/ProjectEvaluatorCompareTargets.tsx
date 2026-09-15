import { Suspense, useEffect, useState } from "react";
import {
  graphql,
  readInlineData,
  useFragment,
  useLazyLoadQuery,
} from "react-relay";
import { useSearchParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Alert,
  Card,
  LinkButton,
  Loading,
  Token,
  View,
} from "@phoenix/components";
import { EmptyState } from "@phoenix/components/core/empty";
import { useTimeRange } from "@phoenix/components/datetime";
import { ErrorBoundary } from "@phoenix/components/exception";
import type { ErrorBoundaryFallbackProps } from "@phoenix/components/exception/types";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import {
  SPAN_FILTER_CONDITION_PARAM,
  TIME_RANGE_KEY_PARAM,
  TIME_RANGE_START_PARAM,
  TIME_RANGE_END_PARAM,
} from "@phoenix/constants/searchParams";
import { ProjectProvider } from "@phoenix/contexts/ProjectContext";
import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";
import {
  TracingProvider,
  useTracingContext,
} from "@phoenix/contexts/TracingContext";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { PendingSpanFilter } from "@phoenix/pages/project/PendingSpanFilter";
import { SessionFiltersProvider } from "@phoenix/pages/project/SessionFiltersContext";
import { SessionsTable } from "@phoenix/pages/project/SessionsTable";
import { SpanFilterErrorFallback } from "@phoenix/pages/project/SpanFilterErrorFallback";
import { SpanFiltersProvider } from "@phoenix/pages/project/SpanFiltersContext";
import {
  spanFilterSeed,
  type SettledSpanFilterSeed,
} from "@phoenix/pages/project/spanFilterSeed";
import { SpansTable } from "@phoenix/pages/project/SpansTable";
import { makeFlatAnnotationColumnId } from "@phoenix/pages/project/tableUtils";
import { TraceFiltersProvider } from "@phoenix/pages/project/TraceFiltersContext";
import { TracesTable } from "@phoenix/pages/project/TracesTable";
import type { EvaluatorOptimizationDirection } from "@phoenix/types/evaluators";

import type { ProjectEvaluatorCompareDistributions_side$key } from "./__generated__/ProjectEvaluatorCompareDistributions_side.graphql";
import type { ProjectEvaluatorCompareTargets_comparison$key } from "./__generated__/ProjectEvaluatorCompareTargets_comparison.graphql";
import type { ProjectEvaluatorCompareTargetsQuery } from "./__generated__/ProjectEvaluatorCompareTargetsQuery.graphql";
import { projectEvaluatorDistributionSideFragment } from "./ProjectEvaluatorCompareDistributions";
import {
  buildCompareFilterCondition,
  type CompareTarget,
  isCompareSelectionValid,
} from "./projectEvaluatorCompareFilterUtils";
import {
  formatCompareSelection,
  useCompareSelection,
} from "./projectEvaluatorCompareSelection";

export function ProjectEvaluatorCompareTargets({
  projectId,
  comparisonRef,
  evaluatorAName,
  evaluatorBName,
  evaluatorAOptimizationDirection,
  evaluatorBOptimizationDirection,
}: {
  projectId: string;
  comparisonRef: ProjectEvaluatorCompareTargets_comparison$key;
  evaluatorAName: string;
  evaluatorBName: string;
  evaluatorAOptimizationDirection: EvaluatorOptimizationDirection | null;
  evaluatorBOptimizationDirection: EvaluatorOptimizationDirection | null;
}) {
  const comparison = useFragment(
    graphql`
      fragment ProjectEvaluatorCompareTargets_comparison on ProjectEvaluatorComparison {
        evaluationTarget
        sideA {
          annotationName
          labels
          threshold
          flaggedLabels
          ...ProjectEvaluatorCompareDistributions_side
        }
        sideB {
          annotationName
          labels
          threshold
          flaggedLabels
          ...ProjectEvaluatorCompareDistributions_side
        }
      }
    `,
    comparisonRef
  );
  const target = comparison.evaluationTarget;
  invariant(
    target === "SPAN" || target === "TRACE" || target === "SESSION",
    "Unknown evaluation target"
  );
  const sideA = {
    ...comparison.sideA,
    distribution: readInlineData<ProjectEvaluatorCompareDistributions_side$key>(
      projectEvaluatorDistributionSideFragment,
      comparison.sideA
    ),
    optimizationDirection: evaluatorAOptimizationDirection,
  };
  const sideB = {
    ...comparison.sideB,
    distribution: readInlineData<ProjectEvaluatorCompareDistributions_side$key>(
      projectEvaluatorDistributionSideFragment,
      comparison.sideB
    ),
    optimizationDirection: evaluatorBOptimizationDirection,
  };
  const { selection, setSelection } = useCompareSelection();
  const isValid =
    !selection || isCompareSelectionValid({ selection, sideA, sideB });
  // A changed time range may remove a categorical bin from the matrix.
  useEffect(() => {
    if (!isValid) setSelection(null, { replace: true });
  }, [isValid, setSelection]);
  const activeSelection = isValid ? selection : null;
  const condition = buildCompareFilterCondition({
    target,
    selection: activeSelection,
    sideA,
    sideB,
  });
  const noun = `${target.toLowerCase()}s`;
  const { rootPath } = useProjectRootPath();
  const [searchParams] = useSearchParams();
  const spansSearch = new URLSearchParams();
  for (const [key, value] of searchParams) {
    if (
      key === TIME_RANGE_KEY_PARAM ||
      key === TIME_RANGE_START_PARAM ||
      key === TIME_RANGE_END_PARAM
    )
      spansSearch.set(key, value);
  }
  spansSearch.set(SPAN_FILTER_CONDITION_PARAM, condition);
  return (
    <Card
      title={`Matching ${noun}`}
      subTitle={
        activeSelection
          ? undefined
          : "Evaluated by both evaluators in the selected time range"
      }
      headerContent={
        activeSelection ? (
          <Token maxWidth="100%" onRemove={() => setSelection(null)}>
            {formatCompareSelection({
              selection: activeSelection,
              evaluatorAName,
              evaluatorBName,
            })}
          </Token>
        ) : undefined
      }
      extra={
        target === "SPAN" ? (
          <LinkButton to={`${rootPath}/spans?${spansSearch}`}>
            Open in Spans
          </LinkButton>
        ) : undefined
      }
    >
      <View height="640px" minHeight={0}>
        <ProjectProvider
          projectId={projectId}
          scope="evaluator-compare"
          showTableAside={false}
          metricChartKeys={{ spans: [], traces: [], sessions: [] }}
        >
          <StreamStateProvider>
            <TracingProvider
              key={target}
              projectId={projectId}
              tableId="evaluator-compare"
              columnVisibility={COMPARE_COLUMN_VISIBILITY}
              columnSizing={{
                name: 150,
                traceId: 130,
                sessionId: 150,
                output_value: 200,
                lastOutput_value: 200,
                startTime: 170,
                [makeFlatAnnotationColumnId(
                  sideA.annotationName,
                  target === "TRACE" ? "trace" : "span"
                )]: 150,
                [makeFlatAnnotationColumnId(
                  sideB.annotationName,
                  target === "TRACE" ? "trace" : "span"
                )]: 150,
              }}
            >
              <CompareAnnotationColumns
                target={target}
                annotationA={sideA.annotationName}
                annotationB={sideB.annotationName}
              />
              <ErrorBoundary key={condition} fallback={CompareTargetsError}>
                <Suspense fallback={<Loading />}>
                  <CompareTargetsFilters
                    projectId={projectId}
                    target={target}
                    condition={condition}
                  />
                </Suspense>
              </ErrorBoundary>
            </TracingProvider>
          </StreamStateProvider>
        </ProjectProvider>
      </View>
    </Card>
  );
}

const COMPARE_COLUMN_VISIBILITY = {
  name: true,
  traceId: true,
  sessionId: true,
  startTime: true,
  output_value: true,
  lastOutput_value: true,
  statusCode: false,
  spanKind: false,
  spanId: false,
  input_value: false,
  firstInput_value: false,
  error: false,
  annotations: false,
  traceAnnotations: false,
  spanNotes: false,
  traceNotes: false,
  metadata: false,
  userId: false,
  latencyMs: false,
  endTime: false,
  tokenCountTotal: false,
  cumulativeTokenCountTotal: false,
  tokenCostTotal: false,
  cumulativeTokenCostTotal: false,
  costTotal: false,
  traceLatencyMsP50: false,
  traceLatencyMsP99: false,
  numTraces: false,
};

function CompareAnnotationColumns({
  target,
  annotationA,
  annotationB,
}: {
  target: CompareTarget;
  annotationA: string;
  annotationB: string;
}) {
  const visibility = useTracingContext((state) =>
    target === "TRACE"
      ? state.traceAnnotationColumnVisibility
      : state.annotationColumnVisibility
  );
  const setVisibility = useTracingContext((state) =>
    target === "TRACE"
      ? state.setTraceAnnotationColumnVisibility
      : state.setAnnotationColumnVisibility
  );
  // Only enable these columns when the pair changes; users can then hide them.
  useEffect(() => {
    setVisibility({ ...visibility, [annotationA]: true, [annotationB]: true });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- the current map is intentionally read only when the pair changes
  }, [annotationA, annotationB, target, setVisibility]);
  return null;
}

type TargetsProps = {
  projectId: string;
  target: CompareTarget;
  condition: string;
};

function CompareTargetsFilters(props: TargetsProps) {
  if (props.target === "SPAN") return <CompareSpanTargets {...props} />;
  if (props.target === "TRACE")
    return (
      <TraceFiltersProvider initialFilterCondition={props.condition}>
        <CompareTargetsTable {...props} />
      </TraceFiltersProvider>
    );
  return (
    <SessionFiltersProvider initialFilterCondition={props.condition}>
      <CompareTargetsTable {...props} />
    </SessionFiltersProvider>
  );
}

function CompareSpanTargets(props: TargetsProps) {
  const [seed, setSeed] = useState<SettledSpanFilterSeed | null>(() => {
    const classified = spanFilterSeed(props.condition);
    return classified.requiresServerValidation ? null : classified;
  });
  return (
    <SpanFiltersProvider
      key={seed ? seed.condition : "pending"}
      fallbackFilterCondition={seed?.condition ?? props.condition}
      persistToUrl={false}
    >
      <ErrorBoundary
        fallback={({ error }) => (
          <SpanFilterErrorFallback error={error} onResolved={setSeed} />
        )}
      >
        {seed ? (
          <CompareTargetsTable
            {...props}
            condition={seed.condition}
            seed={seed}
          />
        ) : (
          <PendingSpanFilter onResolved={setSeed} />
        )}
      </ErrorBoundary>
    </SpanFiltersProvider>
  );
}

function CompareTargetsTable({
  projectId,
  target,
  condition,
  seed,
}: TargetsProps & { seed?: SettledSpanFilterSeed }) {
  const { timeRangeISOStrings } = useTimeRange();
  const [initialTimeRange] = useState(timeRangeISOStrings);
  const data = useLazyLoadQuery<ProjectEvaluatorCompareTargetsQuery>(
    graphql`
      query ProjectEvaluatorCompareTargetsQuery(
        $id: ID!
        $timeRange: TimeRange!
        $condition: String!
        $rootSpansOnly: Boolean!
        $isSpan: Boolean!
        $isTrace: Boolean!
        $isSession: Boolean!
      ) {
        project: node(id: $id) {
          ... on Project {
            ...SpansTable_spans
              @arguments(
                filterCondition: $condition
                rootSpansOnly: $rootSpansOnly
              )
              @include(if: $isSpan)
            ...TracesTable_spans
              @arguments(traceFilterCondition: $condition)
              @include(if: $isTrace)
            ...SessionsTable_sessions
              @arguments(sessionFilterCondition: $condition)
              @include(if: $isSession)
          }
        }
      }
    `,
    {
      id: projectId,
      timeRange: initialTimeRange,
      condition,
      rootSpansOnly: seed?.rootSpansOnly ?? false,
      isSpan: target === "SPAN",
      isTrace: target === "TRACE",
      isSession: target === "SESSION",
    }
  );
  const emptyState = (
    <TableEmptyWrap>
      <EmptyState
        title={`No matching ${target.toLowerCase()}s`}
        description="Try a different comparison selection or time range."
      />
    </TableEmptyWrap>
  );
  if (target === "SPAN") {
    invariant(seed, "Validated span filter required");
    return (
      <SpansTable project={data.project} seed={seed} emptyState={emptyState} />
    );
  }
  if (target === "TRACE")
    return <TracesTable project={data.project} emptyState={emptyState} />;
  return <SessionsTable project={data.project} emptyState={emptyState} />;
}

function CompareTargetsError({ error }: ErrorBoundaryFallbackProps) {
  return (
    <Alert variant="danger" title="Could not load matching targets">
      {error}
    </Alert>
  );
}
