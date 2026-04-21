import { startTransition, useEffect, useRef } from "react";
import { Focusable } from "react-aria";
import { graphql, useRefetchableFragment } from "react-relay";

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
import { useCategoryChartColors } from "@phoenix/components/chart/colors";
import { RichTokenBreakdown } from "@phoenix/components/RichTokenCostBreakdown";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { costFormatter, intFormatter } from "@phoenix/utils/numberFormatUtils";

import type { ProjectStats_project$key } from "./__generated__/ProjectStats_project.graphql";
import type { ProjectStatsQuery } from "./__generated__/ProjectStatsQuery.graphql";
import { AnnotationSummary } from "./AnnotationSummary";
import { DocumentEvaluationSummary } from "./DocumentEvaluationSummary";

type StatsDirection = "row" | "column";

export function ProjectStats(props: {
  project: ProjectStats_project$key;
  direction?: StatsDirection;
  /**
   * Optional span filter condition. When provided, the stats are
   * recomputed against the subset of spans matching the condition.
   */
  filterCondition?: string | null;
}) {
  const direction: StatsDirection = props.direction ?? "row";
  const filterCondition = props.filterCondition || null;
  const { fetchKey } = useStreamState();
  const [data, refetch] = useRefetchableFragment<
    ProjectStatsQuery,
    ProjectStats_project$key
  >(
    graphql`
      fragment ProjectStats_project on Project
      @refetchable(queryName: "ProjectStatsQuery")
      @argumentDefinitions(
        filterCondition: { type: "String", defaultValue: null }
      ) {
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
          probability: 0.50
          timeRange: $timeRange
          filterCondition: $filterCondition
        )
        latencyMsP99: latencyMsQuantile(
          probability: 0.99
          timeRange: $timeRange
          filterCondition: $filterCondition
        )
        spanAnnotationNames
        documentEvaluationNames
      }
    `,
    props.project
  );

  // Refetch when the fetchKey or filterCondition changes. Skip the initial
  // mount when no filter is active — the parent query's store-and-network
  // fetch already returned unfiltered data.
  const hasMounted = useRef<boolean>(false);
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      if (!filterCondition) return;
    }
    startTransition(() => {
      refetch({ filterCondition }, { fetchPolicy: "store-and-network" });
    });
  }, [fetchKey, filterCondition, refetch]);

  const latencyMsP50 = data?.latencyMsP50;
  const latencyMsP99 = data?.latencyMsP99;
  const spanAnnotationNames = data?.spanAnnotationNames?.filter(
    (name) => name !== "note"
  );
  const documentEvaluationNames = data?.documentEvaluationNames;
  const colors = useCategoryChartColors();

  return (
    <Flex
      direction={direction}
      gap={direction === "row" ? "size-400" : "size-200"}
      alignItems={direction === "row" ? "center" : "start"}
    >
      <Flex direction="column" flex="none">
        <Text elementType="h3" size="S" color="text-700">
          Total Traces
        </Text>
        <Text size="L" fontFamily="mono">
          {intFormatter(data?.timeRangeTraceCount)}
        </Text>
      </Flex>
      <Flex direction="column" flex="none">
        <Text elementType="h3" size="S" color="text-700">
          Total Cost
        </Text>
        <TooltipTrigger delay={0}>
          <Focusable>
            <Text size="L" role="button" fontFamily="mono">
              {costFormatter(data?.costSummary?.total?.cost ?? 0)}
            </Text>
          </Focusable>
          <RichTooltip placement="bottom">
            <TooltipArrow />
            <View width="size-3600">
              <RichTokenBreakdown
                valueLabel="cost"
                totalValue={data?.costSummary?.total?.cost ?? 0}
                formatter={costFormatter}
                segments={[
                  {
                    name: "Prompt",
                    value: data?.costSummary?.prompt?.cost ?? 0,
                    color: colors.category1,
                  },
                  {
                    name: "Completion",
                    value: data?.costSummary?.completion?.cost ?? 0,
                    color: colors.category2,
                  },
                ]}
              />
            </View>
          </RichTooltip>
        </TooltipTrigger>
      </Flex>
      <Flex direction="column" flex="none">
        <Text elementType="h3" size="S" color="text-700">
          Latency P50
        </Text>
        {latencyMsP50 != null ? (
          <LatencyText latencyMs={latencyMsP50} size="L" />
        ) : (
          <Text size="L">--</Text>
        )}
      </Flex>
      <Flex direction="column" flex="none">
        <Text elementType="h3" size="S" color="text-700">
          Latency P99
        </Text>
        {latencyMsP99 != null ? (
          <LatencyText latencyMs={latencyMsP99} size="L" />
        ) : (
          <Text size="L">--</Text>
        )}
      </Flex>
      {spanAnnotationNames.map((name) => (
        <ErrorBoundary key={name} fallback={TextErrorBoundaryFallback}>
          <AnnotationSummary
            key={name}
            annotationName={name}
            filterCondition={filterCondition}
          />
        </ErrorBoundary>
      ))}
      {documentEvaluationNames.map((name) => (
        <DocumentEvaluationSummary
          key={`document-${name}`}
          evaluationName={name}
        />
      ))}
    </Flex>
  );
}
