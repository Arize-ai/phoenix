import { Suspense, useEffect, useRef, useState } from "react";
import { Focusable } from "react-aria";
import type { PreloadedQuery } from "react-relay";
import {
  graphql,
  readInlineData,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";
import { Group } from "react-resizable-panels";

import {
  ErrorBoundary,
  Flex,
  RichTooltip,
  Text,
  TextErrorBoundaryFallback,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { useTimeRange } from "@phoenix/components/datetime";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import { TokenCostsDetails } from "@phoenix/components/trace/TokenCostsDetails";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";
import { costFormatter, intFormatter } from "@phoenix/utils/numberFormatUtils";

import type {
  SpansTableAside_stats$data,
  SpansTableAside_stats$key,
} from "./__generated__/SpansTableAside_stats.graphql";
import type { SpansTableAsideQuery } from "./__generated__/SpansTableAsideQuery.graphql";
import { AnnotationSummary } from "./AnnotationSummary";
import { DocumentEvaluationSummary } from "./DocumentEvaluationSummary";
import { getNonNoteAnnotationNames } from "./spanAnnotationUtils";
import {
  LatencyStatItem,
  ProjectInfoTitledPanel,
  StatItem,
  StatsSection,
  TableAsideSkeleton,
} from "./TableAside";
import { TraceAnnotationSummary } from "./TraceAnnotationSummary";
import { useDeferredPartsFailure } from "./useDeferredPartsFailure";

type SpansAsideProject = SpansTableAsideQuery["response"]["project"];

const statsFragment = graphql`
  fragment SpansTableAside_stats on Project @inline {
    timeRangeTraceCount: traceCount(
      timeRange: $timeRange
      filterCondition: $filterCondition
    )
    costSummary(timeRange: $timeRange, filterCondition: $filterCondition) {
      total {
        cost
      }
      prompt {
        cost
      }
      completion {
        cost
      }
    }
    latencyMsP50: latencyMsQuantile(
      probability: 0.5
      timeRange: $timeRange
      filterCondition: $filterCondition
    )
    latencyMsP99: latencyMsQuantile(
      probability: 0.99
      timeRange: $timeRange
      filterCondition: $filterCondition
    )
  }
`;

// The stats arrive in a deferred part; until then each field reads as
// undefined, though Relay types them as present.
type SpansAsideStats = Partial<SpansTableAside_stats$data>;

function getSpansAsideCosts(stats: SpansAsideStats | null) {
  const costSummary = stats?.costSummary;
  return {
    completionCost: costSummary?.completion?.cost ?? 0,
    promptCost: costSummary?.prompt?.cost ?? 0,
    totalCost: costSummary == null ? undefined : (costSummary.total.cost ?? 0),
  };
}

/**
 * The totals to show: those that arrived for the current request, or until
 * they do, the last ones that arrived for this project, so a change of time
 * range or filter keeps the previous totals on screen.
 */
function useShownStats({
  projectId,
  stats,
}: {
  projectId: string;
  stats: SpansAsideStats | null;
}) {
  const haveStatsArrived = stats?.timeRangeTraceCount !== undefined;
  const statsKey = haveStatsArrived ? JSON.stringify(stats) : null;
  const [shown, setShown] = useState({
    projectId,
    statsKey,
    stats: haveStatsArrived ? stats : null,
  });
  const isNewArrival =
    statsKey != null &&
    (statsKey !== shown.statsKey || projectId !== shown.projectId);
  if (isNewArrival) {
    setShown({ projectId, statsKey, stats });
  }
  if (haveStatsArrived) {
    return stats;
  }
  return shown.projectId === projectId ? shown.stats : null;
}

function getSpansAsideValues({
  project,
  stats,
}: {
  project: SpansAsideProject;
  stats: SpansAsideStats | null;
}) {
  return {
    ...getSpansAsideCosts(stats),
    description: project?.description,
    documentEvaluationNames: project?.documentEvaluationNames ?? [],
    latencyMsP50: stats?.latencyMsP50,
    latencyMsP99: stats?.latencyMsP99,
    name: project?.name,
    traceAnnotationNames: getNonNoteAnnotationNames(
      project?.traceAnnotationNames ?? []
    ),
    traceCount: stats?.timeRangeTraceCount,
  };
}

const spansTableAsideQuery = graphql`
  query SpansTableAsideQuery(
    $id: ID!
    $timeRange: TimeRange!
    $filterCondition: String
  ) {
    project: node(id: $id) {
      ... on Project {
        name
        description
        ...SpansTableAside_stats @defer
        traceAnnotationNames
        documentEvaluationNames
      }
    }
  }
`;

export function SpansTableAside(props: {
  filterCondition?: string | null;
  spanAnnotationNames: readonly string[];
}) {
  const filterCondition = props.filterCondition || null;
  const projectId = useTracingContext((state) => state.projectId);
  const { timeRangeISOStrings } = useTimeRange();
  const { fetchKey } = useStreamState();
  const [queryReference, loadAsideQuery] =
    useQueryLoader<SpansTableAsideQuery>(spansTableAsideQuery);
  const variablesKey = JSON.stringify({
    id: projectId,
    timeRange: timeRangeISOStrings,
    filterCondition,
  });
  const loadedKeyRef = useRef<string | null>(null);
  const loadKey = `${variablesKey}|${fetchKey}`;
  // A passive effect, not a layout one: when a boundary above reveals this
  // component, React reruns its effects, and the query loader's own passive
  // effect then releases every reference but the one it last committed, so
  // a reference loaded in a layout effect just before is read disposed. The
  // key keeps a reveal from loading the same query again.
  useEffect(() => {
    if (loadedKeyRef.current === loadKey) {
      return;
    }
    loadedKeyRef.current = loadKey;
    loadAsideQuery(JSON.parse(variablesKey), {
      fetchPolicy: "store-and-network",
    });
  }, [loadAsideQuery, loadKey, variablesKey]);
  if (queryReference == null) {
    return <TableAsideSkeleton />;
  }
  return (
    <Suspense fallback={<TableAsideSkeleton />}>
      <SpansTableAsideContent
        queryReference={queryReference}
        projectId={projectId}
        filterCondition={filterCondition}
        spanAnnotationNames={props.spanAnnotationNames}
      />
    </Suspense>
  );
}

function SpansTableAsideContent(props: {
  queryReference: PreloadedQuery<SpansTableAsideQuery>;
  projectId: string;
  filterCondition: string | null;
  spanAnnotationNames: readonly string[];
}) {
  const { projectId, filterCondition } = props;
  const data = usePreloadedQuery<SpansTableAsideQuery>(
    spansTableAsideQuery,
    props.queryReference
  );
  const { hasRequestFailed } = useDeferredPartsFailure({
    initialRequest: props.queryReference.source,
  });

  const project = data?.project;
  const stats: SpansAsideStats | null = project
    ? readInlineData<SpansTableAside_stats$key>(statsFragment, project)
    : null;
  const shownStats = useShownStats({ projectId, stats });
  const {
    completionCost,
    description,
    documentEvaluationNames,
    latencyMsP50,
    latencyMsP99,
    name,
    promptCost,
    totalCost,
    traceAnnotationNames,
    traceCount,
  } = getSpansAsideValues({ project, stats: shownStats });
  const spanAnnotationNames = getNonNoteAnnotationNames(
    props.spanAnnotationNames
  );
  const haveTotalsFailed =
    stats?.timeRangeTraceCount === undefined && hasRequestFailed;

  return (
    <Group orientation="vertical">
      <ProjectInfoTitledPanel
        projectId={projectId}
        name={name}
        description={description}
      />
      <TitledPanel resizable title="Stats" panelProps={{ minSize: "10%" }}>
        <View padding="size-200" overflow="auto" height="100%">
          <Flex direction="column" gap="size-300" minWidth="size-3400">
            <Flex direction="column" gap="size-200" alignItems="start">
              {haveTotalsFailed ? (
                <Text color="text-700">
                  Trace count, cost and latency failed to load.
                </Text>
              ) : (
                <>
                  <StatItem label="Total Traces">
                    <Text size="L" fontFamily="mono">
                      {intFormatter(traceCount)}
                    </Text>
                  </StatItem>
                  <StatItem label="Total Cost">
                    <TooltipTrigger delay={0} isDisabled={!totalCost}>
                      <Focusable>
                        <Text size="L" role="button" fontFamily="mono">
                          {totalCost == null ? "--" : costFormatter(totalCost)}
                        </Text>
                      </Focusable>
                      <RichTooltip placement="bottom">
                        <TooltipArrow />
                        <View width="size-3600">
                          <TokenCostsDetails
                            total={totalCost ?? 0}
                            prompt={promptCost}
                            completion={completionCost}
                          />
                        </View>
                      </RichTooltip>
                    </TooltipTrigger>
                  </StatItem>
                  <LatencyStatItem
                    label="Latency P50"
                    latencyMs={latencyMsP50}
                  />
                  <LatencyStatItem
                    label="Latency P99"
                    latencyMs={latencyMsP99}
                  />
                </>
              )}
            </Flex>
            {spanAnnotationNames.length > 0 ? (
              <StatsSection title="Span Annotations">
                {spanAnnotationNames.map((name) => (
                  <ErrorBoundary
                    key={name}
                    fallback={TextErrorBoundaryFallback}
                  >
                    <AnnotationSummary
                      annotationName={name}
                      filterCondition={filterCondition}
                    />
                  </ErrorBoundary>
                ))}
              </StatsSection>
            ) : null}
            {documentEvaluationNames.length > 0 ? (
              <StatsSection title="Document Annotations">
                {documentEvaluationNames.map((name) => (
                  <DocumentEvaluationSummary
                    key={`document-${name}`}
                    evaluationName={name}
                  />
                ))}
              </StatsSection>
            ) : null}
            {traceAnnotationNames.length > 0 ? (
              <StatsSection title="Trace Annotations">
                {traceAnnotationNames.map((name) => (
                  <ErrorBoundary
                    key={`trace-${name}`}
                    fallback={TextErrorBoundaryFallback}
                  >
                    <TraceAnnotationSummary
                      annotationName={name}
                      filterCondition={filterCondition}
                    />
                  </ErrorBoundary>
                ))}
              </StatsSection>
            ) : null}
          </Flex>
        </View>
      </TitledPanel>
    </Group>
  );
}
