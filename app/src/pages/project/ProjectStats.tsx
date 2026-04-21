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

export function ProjectStats(props: { project: ProjectStats_project$key }) {
  const { fetchKey } = useStreamState();
  const isFirstRender = useRef(true);
  const [data, refetch] = useRefetchableFragment<
    ProjectStatsQuery,
    ProjectStats_project$key
  >(
    graphql`
      fragment ProjectStats_project on Project
      @refetchable(queryName: "ProjectStatsQuery") {
        timeRangeTraceCount: traceCount(timeRange: $timeRange)
        costSummary(timeRange: $timeRange) {
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
        latencyMsP50: latencyMsQuantile(probability: 0.50, timeRange: $timeRange)
        latencyMsP99: latencyMsQuantile(probability: 0.99, timeRange: $timeRange)
        spanAnnotationNames
        documentEvaluationNames
      }
    `,
    props.project
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    startTransition(() => {
      refetch({}, { fetchPolicy: "store-and-network" });
    });
  }, [fetchKey, refetch]);

  const latencyMsP50 = data?.latencyMsP50;
  const latencyMsP99 = data?.latencyMsP99;
  const spanAnnotationNames = data?.spanAnnotationNames?.filter(
    (name) => name !== "note"
  );
  const documentEvaluationNames = data?.documentEvaluationNames;
  const colors = useCategoryChartColors();

  return (
    <Flex direction="row" gap="size-400" alignItems="center">
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
          <AnnotationSummary annotationName={name} />
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
