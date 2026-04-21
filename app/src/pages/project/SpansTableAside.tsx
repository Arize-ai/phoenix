import { startTransition, useEffect } from "react";
import { Focusable } from "react-aria";
import { graphql, useRefetchableFragment } from "react-relay";

import {
  ErrorBoundary,
  Flex,
  Heading,
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

import type { SpansTableAside_project$key } from "./__generated__/SpansTableAside_project.graphql";
import type { SpansTableAsideQuery } from "./__generated__/SpansTableAsideQuery.graphql";
import { AnnotationSummary } from "./AnnotationSummary";
import { DocumentEvaluationSummary } from "./DocumentEvaluationSummary";

export function SpansTableAside(props: {
  project: SpansTableAside_project$key;
  filterCondition?: string | null;
}) {
  const filterCondition = props.filterCondition || null;
  const { fetchKey } = useStreamState();
  const [data, refetch] = useRefetchableFragment<
    SpansTableAsideQuery,
    SpansTableAside_project$key
  >(
    graphql`
      fragment SpansTableAside_project on Project
      @refetchable(queryName: "SpansTableAsideQuery")
      @argumentDefinitions(filterCondition: { type: "String", defaultValue: null }) {
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

  useEffect(() => {
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
    <View padding="size-200" height="100%" overflow="auto">
      <Flex direction="column" gap="size-200" minWidth="size-3400">
        <Heading level={3} weight="heavy">
          Stats
        </Heading>
        <Flex direction="column" gap="size-200" alignItems="start">
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
      </Flex>
    </View>
  );
}
