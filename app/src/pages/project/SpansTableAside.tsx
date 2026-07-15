import { Focusable } from "react-aria";
import { graphql, useLazyLoadQuery } from "react-relay";
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
import { useCategoryChartColors } from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/components/datetime";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import { RichTokenBreakdown } from "@phoenix/components/RichTokenCostBreakdown";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";
import { costFormatter, intFormatter } from "@phoenix/utils/numberFormatUtils";

import type { SpansTableAsideQuery } from "./__generated__/SpansTableAsideQuery.graphql";
import { AnnotationSummary } from "./AnnotationSummary";
import { DocumentEvaluationSummary } from "./DocumentEvaluationSummary";
import { getNonNoteAnnotationNames } from "./spanAnnotationUtils";
import {
  LatencyStatItem,
  ProjectInfoTitledPanel,
  StatItem,
  StatsSection,
} from "./TableAside";
import { TraceAnnotationSummary } from "./TraceAnnotationSummary";

export function SpansTableAside(props: { filterCondition?: string | null }) {
  const filterCondition = props.filterCondition || null;
  const projectId = useTracingContext((state) => state.projectId);
  const { timeRangeISOStrings } = useTimeRange();
  const { fetchKey } = useStreamState();
  const data = useLazyLoadQuery<SpansTableAsideQuery>(
    graphql`
      query SpansTableAsideQuery(
        $id: ID!
        $timeRange: TimeRange!
        $filterCondition: String
      ) {
        project: node(id: $id) {
          ... on Project {
            name
            description
            timeRangeTraceCount: traceCount(
              timeRange: $timeRange
              filterCondition: $filterCondition
            )
            costSummary(
              timeRange: $timeRange
              filterCondition: $filterCondition
            ) {
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
            spanAnnotationNames
            traceAnnotationsNames
            documentEvaluationNames
          }
        }
      }
    `,
    {
      id: projectId,
      timeRange: timeRangeISOStrings,
      filterCondition,
    },
    { fetchKey, fetchPolicy: "store-and-network" }
  );

  const project = data?.project;
  const spanAnnotationNames = getNonNoteAnnotationNames(
    project?.spanAnnotationNames ?? []
  );
  const traceAnnotationNames = getNonNoteAnnotationNames(
    project?.traceAnnotationsNames ?? []
  );
  const documentEvaluationNames = project?.documentEvaluationNames ?? [];
  const colors = useCategoryChartColors();

  return (
    <Group orientation="vertical">
      <ProjectInfoTitledPanel
        projectId={projectId}
        name={project?.name}
        description={project?.description}
      />
      <TitledPanel resizable title="Stats" panelProps={{ minSize: "10%" }}>
        <View padding="size-200" overflow="auto" height="100%">
          <Flex direction="column" gap="size-300" minWidth="size-3400">
            <Flex direction="column" gap="size-200" alignItems="start">
              <StatItem label="Total Traces">
                <Text size="L" fontFamily="mono">
                  {intFormatter(project?.timeRangeTraceCount)}
                </Text>
              </StatItem>
              <StatItem label="Total Cost">
                <TooltipTrigger delay={0}>
                  <Focusable>
                    <Text size="L" role="button" fontFamily="mono">
                      {costFormatter(project?.costSummary?.total?.cost ?? 0)}
                    </Text>
                  </Focusable>
                  <RichTooltip placement="bottom">
                    <TooltipArrow />
                    <View width="size-3600">
                      <RichTokenBreakdown
                        valueLabel="cost"
                        totalValue={project?.costSummary?.total?.cost ?? 0}
                        formatter={costFormatter}
                        segments={[
                          {
                            name: "Prompt",
                            value: project?.costSummary?.prompt?.cost ?? 0,
                            color: colors.category1,
                          },
                          {
                            name: "Completion",
                            value: project?.costSummary?.completion?.cost ?? 0,
                            color: colors.category2,
                          },
                        ]}
                      />
                    </View>
                  </RichTooltip>
                </TooltipTrigger>
              </StatItem>
              <LatencyStatItem
                label="Latency P50"
                latencyMs={project?.latencyMsP50}
              />
              <LatencyStatItem
                label="Latency P99"
                latencyMs={project?.latencyMsP99}
              />
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
