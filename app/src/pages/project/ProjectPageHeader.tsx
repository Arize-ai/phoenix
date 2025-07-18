import { ReactNode, startTransition, useEffect } from "react";
import { Focusable } from "react-aria";
import { graphql, useRefetchableFragment } from "react-relay";
import { css } from "@emotion/react";

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
import { RichTokenBreakdown } from "@phoenix/components/RichTokenCostBreakdown";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { costFormatter, intFormatter } from "@phoenix/utils/numberFormatUtils";

import { ProjectPageHeader_stats$key } from "./__generated__/ProjectPageHeader_stats.graphql";
import { ProjectPageHeaderQuery } from "./__generated__/ProjectPageHeaderQuery.graphql";
import { AnnotationSummary } from "./AnnotationSummary";
import { DocumentEvaluationSummary } from "./DocumentEvaluationSummary";

export function ProjectPageHeader(props: {
  project: ProjectPageHeader_stats$key;
  /**
   * the extra component displayed on the right side of the header
   */
  extra: ReactNode;
}) {
  const { extra } = props;
  const { fetchKey } = useStreamState();
  const [data, refetch] = useRefetchableFragment<
    ProjectPageHeaderQuery,
    ProjectPageHeader_stats$key
  >(
    graphql`
      fragment ProjectPageHeader_stats on Project
      @refetchable(queryName: "ProjectPageHeaderQuery") {
        traceCount(timeRange: $timeRange)
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
        latencyMsP50: latencyMsQuantile(
          probability: 0.50
          timeRange: $timeRange
        )
        latencyMsP99: latencyMsQuantile(
          probability: 0.99
          timeRange: $timeRange
        )
        spanAnnotationNames
        documentEvaluationNames
      }
    `,
    props.project
  );

  // Refetch the count of traces if the fetchKey changes
  useEffect(() => {
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

  return (
    <View
      paddingStart="size-200"
      paddingEnd="size-200"
      paddingTop="size-200"
      paddingBottom="size-50"
      flex="none"
    >
      <Flex direction="row" justifyContent="space-between" alignItems="center">
        <div
          css={css`
            overflow-x: auto;
            overflow-y: hidden;
            flex: 1 1 auto;
            background-image: linear-gradient(
                to right,
                var(--ac-global-color-grey-75),
                var(--ac-global-color-grey-75)
              ),
              linear-gradient(
                to right,
                var(--ac-global-color-grey-75),
                var(--ac-global-color-grey-75)
              ),
              linear-gradient(
                to right,
                rgba(var(--ac-global-color-grey-300-rgb), 0.9),
                rgba(var(--ac-global-color-grey-300-rgb), 0)
              ),
              linear-gradient(
                to left,
                rgba(var(--ac-global-color-grey-300-rgb), 0.9),
                rgba(var(--ac-global-color-grey-300-rgb), 0)
              );
            background-repeat: no-repeat;
            background-size:
              32px 100%,
              32px 100%,
              32px 100%,
              32px 100%;
            background-position:
              left center,
              right center,
              left center,
              right center;
            background-attachment: local, local, scroll, scroll;
          `}
        >
          <Flex direction="row" gap="size-400" alignItems="center">
            <Flex direction="column" flex="none">
              <Text elementType="h3" size="S" color="text-700">
                Total Traces
              </Text>
              <Text size="L">{intFormatter(data?.traceCount)}</Text>
            </Flex>
            <Flex direction="column" flex="none">
              <Text elementType="h3" size="S" color="text-700">
                Total Cost
              </Text>
              <TooltipTrigger delay={0}>
                <Focusable>
                  <Text size="L">
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
                          color: "rgba(254, 119, 99, 1)",
                        },
                        {
                          name: "Completion",
                          value: data?.costSummary?.completion?.cost ?? 0,
                          color: "rgba(98, 104, 239, 1)",
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
                <AnnotationSummary key={name} annotationName={name} />
              </ErrorBoundary>
            ))}
            {documentEvaluationNames.map((name) => (
              <DocumentEvaluationSummary
                key={`document-${name}`}
                evaluationName={name}
              />
            ))}
          </Flex>
        </div>
        <View flex="none" paddingStart="size-100">
          {extra}
        </View>
      </Flex>
    </View>
  );
}
