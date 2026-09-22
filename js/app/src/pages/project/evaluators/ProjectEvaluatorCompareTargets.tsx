import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { graphql, useFragment, useLazyLoadQuery } from "react-relay";
import { useParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Alert,
  Flex,
  Heading,
  LinkButton,
  Loading,
  Text,
  Token,
} from "@phoenix/components";
import { EmptyState } from "@phoenix/components/core/empty";
import { useTimeRangeSearch } from "@phoenix/components/datetime";
import { ErrorBoundary } from "@phoenix/components/exception";
import type { ErrorBoundaryFallbackProps } from "@phoenix/components/exception/types";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { SPAN_FILTER_CONDITION_PARAM } from "@phoenix/constants/searchParams";
import { ProjectProvider } from "@phoenix/contexts/ProjectContext";
import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";
import { TracingProvider } from "@phoenix/contexts/TracingContext";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import type { ProjectTab } from "@phoenix/pages/project/constants";
import { SessionFiltersProvider } from "@phoenix/pages/project/SessionFiltersContext";
import { SessionsTable } from "@phoenix/pages/project/SessionsTable";
import { SpanFilterErrorFallback } from "@phoenix/pages/project/SpanFilterErrorFallback";
import { SpanFiltersProvider } from "@phoenix/pages/project/SpanFiltersContext";
import type { SettledSpanFilterSeed } from "@phoenix/pages/project/spanFilterSeed";
import { SpansTable } from "@phoenix/pages/project/SpansTable";
import { makeFlatAnnotationColumnId } from "@phoenix/pages/project/tableUtils";
import { TraceFiltersProvider } from "@phoenix/pages/project/TraceFiltersContext";
import { TracesTable } from "@phoenix/pages/project/TracesTable";
import { withSearchParams } from "@phoenix/utils/urlUtils";

import type { ProjectEvaluatorCompareTargets_comparison$key } from "./__generated__/ProjectEvaluatorCompareTargets_comparison.graphql";
import type { ProjectEvaluatorCompareTargets_evaluator$key } from "./__generated__/ProjectEvaluatorCompareTargets_evaluator.graphql";
import type { ProjectEvaluatorCompareTargetsQuery } from "./__generated__/ProjectEvaluatorCompareTargetsQuery.graphql";
import {
  buildCompareFilterCondition,
  type CompareTarget,
  isCompareSelectionValid,
} from "./projectEvaluatorCompareFilterUtils";
import { formatCompareSelection } from "./projectEvaluatorCompareSelection";
import { useCompareSelection } from "./ProjectEvaluatorCompareSelectionContext";

const targetsTableCSS = css`
  transition: opacity 150ms ease-in-out;
  &[aria-busy="true"] {
    opacity: 0.6;
  }
`;

const evaluatorFragment = graphql`
  fragment ProjectEvaluatorCompareTargets_evaluator on ProjectEvaluator {
    evaluator {
      outputConfigs {
        ... on CategoricalAnnotationConfig {
          optimizationDirection
        }
        ... on ContinuousAnnotationConfig {
          optimizationDirection
        }
        ... on FreeformAnnotationConfig {
          optimizationDirection
        }
      }
    }
  }
`;

export function ProjectEvaluatorCompareTargets({
  projectId,
  comparisonRef,
  evaluatorARef,
  evaluatorBRef,
  timeRange,
}: {
  projectId: string;
  comparisonRef: ProjectEvaluatorCompareTargets_comparison$key;
  evaluatorARef: ProjectEvaluatorCompareTargets_evaluator$key;
  evaluatorBRef: ProjectEvaluatorCompareTargets_evaluator$key;
  timeRange: TimeRange;
}) {
  const evaluatorA = useFragment(evaluatorFragment, evaluatorARef);
  const evaluatorB = useFragment(evaluatorFragment, evaluatorBRef);
  const comparison = useFragment(
    graphql`
      fragment ProjectEvaluatorCompareTargets_comparison on ProjectEvaluatorComparison {
        evaluationTarget
        sideA: a {
          annotationName
          labels
          threshold
        }
        sideB: b {
          annotationName
          labels
          threshold
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
    optimizationDirection:
      evaluatorA.evaluator.outputConfigs[0]?.optimizationDirection ?? null,
  };
  const sideB = {
    ...comparison.sideB,
    optimizationDirection:
      evaluatorB.evaluator.outputConfigs[0]?.optimizationDirection ?? null,
  };
  const { selection, optimisticSelection, isPending, setSelection } =
    useCompareSelection();
  // Ignore a selection when its bin is absent from the current time range.
  const isValid =
    !selection || isCompareSelectionValid({ selection, sideA, sideB });
  const activeSelection = isValid ? selection : null;
  const shownSelection = isPending ? optimisticSelection : activeSelection;
  const condition = buildCompareFilterCondition({
    target,
    selection: activeSelection,
    sideA,
    sideB,
  });
  const noun = `${target.toLowerCase()}s`;
  const compareAnnotationVisibility = {
    [sideA.annotationName]: true,
    [sideB.annotationName]: true,
  };
  const { rootPath } = useProjectRootPath();
  const spansSearch = withSearchParams(useTimeRangeSearch(), (params) =>
    params.set(SPAN_FILTER_CONDITION_PARAM, condition)
  );
  return (
    <Flex direction="column" gap="size-100">
      <Flex
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap="size-200"
      >
        <Flex direction="row" alignItems="center" gap="size-100" wrap>
          <Heading level={2}>{`Matching ${noun}`}</Heading>
          {shownSelection ? (
            <Token maxWidth="100%" onRemove={() => setSelection(null)}>
              {formatCompareSelection(shownSelection)}
            </Token>
          ) : (
            <Text color="text-700">
              Evaluated by both evaluators in the selected time range
            </Text>
          )}
        </Flex>
        {target === "SPAN" ? (
          <LinkButton to={`${rootPath}/spans${spansSearch}`}>
            Open in Spans
          </LinkButton>
        ) : null}
      </Flex>
      <ProjectProvider
        projectId={projectId}
        scope="evaluator-compare"
        showTableAside={false}
        showMetricCharts={false}
      >
        <StreamStateProvider>
          {/* Comparison columns are scoped to this evaluator pair. */}
          <TracingProvider
            projectId={projectId}
            tableId={COMPARE_TABLE_IDS[target]}
            persistPreferences={false}
            columnVisibility={COMPARE_COLUMN_VISIBILITY}
            annotationColumnVisibility={
              target === "TRACE" ? undefined : compareAnnotationVisibility
            }
            traceAnnotationColumnVisibility={
              target === "TRACE" ? compareAnnotationVisibility : undefined
            }
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
            {/* Keep current rows visible while the next selection loads. */}
            <div css={targetsTableCSS} aria-busy={isPending}>
              <Suspense fallback={<Loading />}>
                <ErrorBoundary key={condition} fallback={CompareTargetsError}>
                  <CompareTargetsFilters
                    projectId={projectId}
                    target={target}
                    condition={condition}
                    timeRange={timeRange}
                  />
                </ErrorBoundary>
              </Suspense>
            </div>
          </TracingProvider>
        </StreamStateProvider>
      </ProjectProvider>
    </Flex>
  );
}

const COMPARE_TABLE_IDS = {
  SPAN: "spans",
  TRACE: "traces",
  SESSION: "sessions",
} as const satisfies Record<CompareTarget, ProjectTab>;

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

type TargetsProps = {
  projectId: string;
  target: CompareTarget;
  condition: string;
  timeRange: TimeRange;
};

type TargetsTableProps = Omit<TargetsProps, "target"> &
  (
    | { target: "SPAN"; seed: SettledSpanFilterSeed }
    | { target: "TRACE" | "SESSION" }
  );

function CompareTargetsFilters(props: TargetsProps) {
  if (props.target === "SPAN") return <CompareSpanTargets {...props} />;
  if (props.target === "TRACE")
    return (
      <TraceFiltersProvider initialFilterCondition={props.condition}>
        <CompareTargetsTable {...props} target="TRACE" />
      </TraceFiltersProvider>
    );
  return (
    <SessionFiltersProvider initialFilterCondition={props.condition}>
      <CompareTargetsTable {...props} target="SESSION" />
    </SessionFiltersProvider>
  );
}

function CompareSpanTargets(props: TargetsProps) {
  // Generated conditions skip arbitrary-text validation but retain its fallback.
  const [seed, setSeed] = useState<SettledSpanFilterSeed>(() => ({
    condition: props.condition,
    requiresServerValidation: false,
    rootSpansOnly: false,
  }));
  return (
    <SpanFiltersProvider
      key={seed.condition}
      fallbackFilterCondition={seed.condition}
      persistToUrl={false}
    >
      <ErrorBoundary
        fallback={({ error }) => (
          <SpanFilterErrorFallback error={error} onResolved={setSeed} />
        )}
      >
        <CompareTargetsTable
          {...props}
          target="SPAN"
          condition={seed.condition}
          seed={seed}
        />
      </ErrorBoundary>
    </SpanFiltersProvider>
  );
}

function CompareTargetsTable(props: TargetsTableProps) {
  const { projectId, target, condition, timeRange } = props;
  const seed = props.target === "SPAN" ? props.seed : null;
  const { targetId } = useParams();
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
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
      condition,
      rootSpansOnly: seed?.rootSpansOnly ?? false,
      isSpan: target === "SPAN",
      isTrace: target === "TRACE",
      isSession: target === "SESSION",
    },
    // Refresh cached rows when a selection is revisited.
    { fetchPolicy: "store-and-network" }
  );
  const emptyState = (
    <TableEmptyWrap>
      <EmptyState
        title={`No matching ${target.toLowerCase()}s`}
        description="Try a different comparison selection or time range."
      />
    </TableEmptyWrap>
  );
  if (props.target === "SPAN") {
    return (
      <SpansTable
        project={data.project}
        seed={props.seed}
        emptyState={emptyState}
        selectedRowId={targetId}
      />
    );
  }
  if (target === "TRACE")
    return (
      <TracesTable
        project={data.project}
        emptyState={emptyState}
        selectedRowId={targetId}
      />
    );
  return (
    <SessionsTable
      project={data.project}
      emptyState={emptyState}
      selectedRowId={targetId}
    />
  );
}

function CompareTargetsError({ error }: ErrorBoundaryFallbackProps) {
  return (
    <Alert variant="danger" title="Could not load matching targets">
      {error}
    </Alert>
  );
}
