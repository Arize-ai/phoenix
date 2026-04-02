import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { startTransition, Suspense, useRef, useEffect } from "react";
import { Focusable } from "react-aria";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useRefetchableFragment,
} from "react-relay";
import { useParams } from "react-router";

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
import { Skeleton } from "@phoenix/components/core/loading";
import { useTimeRange } from "@phoenix/components/datetime";
import { RichTokenBreakdown } from "@phoenix/components/RichTokenCostBreakdown";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { costFormatter, intFormatter } from "@phoenix/utils/numberFormatUtils";

import type { ProjectPageHeader_stats$key } from "./__generated__/ProjectPageHeader_stats.graphql";
import type { ProjectPageHeaderDeferredMetrics_project$key } from "./__generated__/ProjectPageHeaderDeferredMetrics_project.graphql";
import type { ProjectPageHeaderDeferredStatsQuery } from "./__generated__/ProjectPageHeaderDeferredStatsQuery.graphql";
import type { ProjectPageHeaderDeferredSummaryNames_project$key } from "./__generated__/ProjectPageHeaderDeferredSummaryNames_project.graphql";
import type { ProjectPageHeaderQuery } from "./__generated__/ProjectPageHeaderQuery.graphql";
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
        timeRangeTraceCount: traceCount(timeRange: $timeRange)
      }
    `,
    props.project
  );

  // Refetch the count of traces if the fetchKey changes.
  // Skip the initial mount — the parent useLazyLoadQuery with
  // store-and-network already fetches fresh data.
  const hasMounted = useRef<boolean>(false);
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    startTransition(() => {
      refetch({}, { fetchPolicy: "store-and-network" });
    });
  }, [fetchKey, refetch]);

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
            background-image:
              linear-gradient(
                to right,
                var(--global-color-gray-75),
                var(--global-color-gray-75)
              ),
              linear-gradient(
                to right,
                var(--global-color-gray-75),
                var(--global-color-gray-75)
              ),
              linear-gradient(
                to right,
                rgba(var(--global-color-gray-300-rgb), 0.9),
                rgba(var(--global-color-gray-300-rgb), 0)
              ),
              linear-gradient(
                to left,
                rgba(var(--global-color-gray-300-rgb), 0.9),
                rgba(var(--global-color-gray-300-rgb), 0)
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
              <Text size="L" fontFamily="mono">
                {intFormatter(data?.timeRangeTraceCount)}
              </Text>
            </Flex>
            <Suspense fallback={<ProjectPageHeaderDeferredStatsFallback />}>
              <ProjectPageHeaderDeferredStats />
            </Suspense>
          </Flex>
        </div>
        <View flex="none" paddingStart="size-100">
          {extra}
        </View>
      </Flex>
    </View>
  );
}

function ProjectPageHeaderDeferredStats() {
  const { projectId } = useParams();
  const { timeRange } = useTimeRange();
  const { fetchKey } = useStreamState();
  const data = useLazyLoadQuery<ProjectPageHeaderDeferredStatsQuery>(
    graphql`
      query ProjectPageHeaderDeferredStatsQuery($id: ID!, $timeRange: TimeRange!) {
        project: node(id: $id) {
          ... on Project {
            id
            ...ProjectPageHeaderDeferredMetrics_project
              @defer(label: "ProjectPageHeaderDeferredMetrics")
            ...ProjectPageHeaderDeferredSummaryNames_project
              @defer(label: "ProjectPageHeaderDeferredSummaryNames")
          }
        }
      }
    `,
    {
      id: projectId as string,
      timeRange: {
        start: timeRange?.start?.toISOString(),
        end: timeRange?.end?.toISOString(),
      },
    },
    {
      fetchKey,
      fetchPolicy: "store-and-network",
    }
  );
  if (!data.project) {
    return null;
  }

  return (
    <>
      <Suspense fallback={<ProjectPageHeaderDeferredStatsFallback />}>
        <ProjectPageHeaderDeferredMetrics project={data.project} />
      </Suspense>
      <Suspense fallback={null}>
        <ProjectPageHeaderDeferredSummaries project={data.project} />
      </Suspense>
    </>
  );
}

function ProjectPageHeaderDeferredMetrics(props: {
  project: ProjectPageHeaderDeferredMetrics_project$key;
}) {
  const colors = useCategoryChartColors();
  const data = useFragment<ProjectPageHeaderDeferredMetrics_project$key>(
    graphql`
      fragment ProjectPageHeaderDeferredMetrics_project on Project {
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
        latencyMsP50: latencyMsQuantile(probability: 0.5, timeRange: $timeRange)
        latencyMsP99: latencyMsQuantile(probability: 0.99, timeRange: $timeRange)
      }
    `,
    props.project
  );

  const latencyMsP50 = data?.latencyMsP50;
  const latencyMsP99 = data?.latencyMsP99;

  return (
    <>
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
    </>
  );
}

function ProjectPageHeaderDeferredSummaries(props: {
  project: ProjectPageHeaderDeferredSummaryNames_project$key;
}) {
  const data = useFragment<ProjectPageHeaderDeferredSummaryNames_project$key>(
    graphql`
      fragment ProjectPageHeaderDeferredSummaryNames_project on Project {
        spanAnnotationNames
        documentEvaluationNames
      }
    `,
    props.project
  );

  const spanAnnotationNames =
    data?.spanAnnotationNames?.filter((name) => name !== "note") ?? [];
  const documentEvaluationNames = data?.documentEvaluationNames ?? [];

  return (
    <>
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
    </>
  );
}

function ProjectPageHeaderDeferredStatsFallback() {
  return (
    <>
      <DeferredMetricFallback label="Total Cost" />
      <DeferredMetricFallback label="Latency P50" />
      <DeferredMetricFallback label="Latency P99" />
    </>
  );
}

function DeferredMetricFallback({ label }: { label: string }) {
  return (
    <Flex direction="column" flex="none">
      <Text elementType="h3" size="S" color="text-700">
        {label}
      </Text>
      <Skeleton width={60} height="1.4em" />
    </Flex>
  );
}
