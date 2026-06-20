import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Focusable } from "react-aria";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Group } from "react-resizable-panels";

import {
  CopyField,
  CopyInput,
  ErrorBoundary,
  Flex,
  Label,
  RichTooltip,
  Text,
  TextErrorBoundaryFallback,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { useCategoryChartColors } from "@phoenix/components/chart/colors";
import { useTimeRange } from "@phoenix/components/datetime";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import { RichTokenBreakdown } from "@phoenix/components/RichTokenCostBreakdown";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";
import { costFormatter, intFormatter } from "@phoenix/utils/numberFormatUtils";

import type { SpansTableAsideQuery } from "./__generated__/SpansTableAsideQuery.graphql";
import { AnnotationSummary } from "./AnnotationSummary";
import { DocumentEvaluationSummary } from "./DocumentEvaluationSummary";
import { TraceAnnotationSummary } from "./TraceAnnotationSummary";

const sectionHeadingCSS = css`
  font-size: var(--global-font-size-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--global-text-color-700);
  margin: 0 0 var(--global-dimension-size-100) 0;
  padding-bottom: var(--global-dimension-size-50);
  border-bottom: 1px solid var(--global-border-color-default);
`;

/**
 * A titled group of stats. The heading doubles as a divider — an underlined,
 * uppercase label — so each level of feedback (span, document, trace) reads as
 * its own clearly delineated section rather than one undifferentiated list.
 */
function StatsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      css={css`
        width: 100%;
      `}
    >
      <h3 css={sectionHeadingCSS}>{title}</h3>
      <Flex direction="column" gap="size-200" alignItems="start">
        {children}
      </Flex>
    </section>
  );
}

export function SpansTableAside(props: { filterCondition?: string | null }) {
  const filterCondition = props.filterCondition || null;
  const projectId = useTracingContext((state) => state.projectId);
  const { timeRange } = useTimeRange();
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
      timeRange: {
        start: timeRange?.start?.toISOString(),
        end: timeRange?.end?.toISOString(),
      },
      filterCondition,
    },
    { fetchKey, fetchPolicy: "store-and-network" }
  );

  const project = data?.project;
  const latencyMsP50 = project?.latencyMsP50;
  const latencyMsP99 = project?.latencyMsP99;
  const spanAnnotationNames =
    project?.spanAnnotationNames?.filter((name) => name !== "note") ?? [];
  const traceAnnotationNames =
    project?.traceAnnotationsNames?.filter((name) => name !== "note") ?? [];
  const documentEvaluationNames = project?.documentEvaluationNames ?? [];
  const colors = useCategoryChartColors();

  return (
    <Group orientation="vertical">
      <TitledPanel
        title="Project Info"
        panelProps={{
          defaultSize: "0%",
          minSize: 240,
        }}
      >
        <View padding="size-200" overflow="auto" height="100%">
          <Flex direction="column" gap="size-100" minWidth="size-3400">
            <CopyField value={project?.name ?? ""}>
              <Label>Name</Label>
              <CopyInput />
            </CopyField>
            <CopyField value={projectId}>
              <Label>ID</Label>
              <CopyInput />
            </CopyField>
            <CopyField value={project?.description ?? ""}>
              <Label>Description</Label>
              <CopyInput />
            </CopyField>
          </Flex>
        </View>
      </TitledPanel>
      <TitledPanel resizable title="Stats" panelProps={{ minSize: "10%" }}>
        <View padding="size-200" overflow="auto" height="100%">
          <Flex direction="column" gap="size-300" minWidth="size-3400">
            <Flex direction="column" gap="size-200" alignItems="start">
              <Flex direction="column" flex="none">
                <Text elementType="h3" size="S" color="text-700">
                  Total Traces
                </Text>
                <Text size="L" fontFamily="mono">
                  {intFormatter(project?.timeRangeTraceCount)}
                </Text>
              </Flex>
              <Flex direction="column" flex="none">
                <Text elementType="h3" size="S" color="text-700">
                  Total Cost
                </Text>
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
              <StatsSection title="Document Evaluations">
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
