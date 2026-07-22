import { graphql, useLazyLoadQuery } from "react-relay";
import { Group } from "react-resizable-panels";

import {
  ErrorBoundary,
  Flex,
  Text,
  TextErrorBoundaryFallback,
  View,
} from "@phoenix/components";
import { useTimeRange } from "@phoenix/components/datetime";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";
import { floatFormatter, intFormatter } from "@phoenix/utils/numberFormatUtils";

import type { SessionsTableAsideQuery } from "./__generated__/SessionsTableAsideQuery.graphql";
import { SessionAnnotationSummary } from "./SessionAnnotationSummary";
import { getNonNoteAnnotationNames } from "./spanAnnotationUtils";
import {
  LatencyStatItem,
  ProjectInfoTitledPanel,
  StatItem,
  StatsSection,
} from "./TableAside";

/**
 * Top-level session stats for the sessions table — session count, average
 * traces (turns) per session, session duration (average and P50/P99), and
 * per-annotation summaries. Mirrors {@link SpansTableAside} so the sessions
 * tab gets the same collapsible stats panel as the spans tab.
 */
export function SessionsTableAside(props: {
  /**
   * The sessions table search text. Like the table, the stats treat it as
   * both an input/output substring filter and an exact session-ID lookup,
   * with an exact match taking precedence.
   */
  filterIoSubstringOrSessionId?: string | null;
}) {
  const filterIoSubstringOrSessionId =
    props.filterIoSubstringOrSessionId || null;
  const projectId = useTracingContext((state) => state.projectId);
  const { timeRangeISOStrings } = useTimeRange();
  const { fetchKey } = useStreamState();
  const data = useLazyLoadQuery<SessionsTableAsideQuery>(
    graphql`
      query SessionsTableAsideQuery(
        $id: ID!
        $timeRange: TimeRange!
        $filterIoSubstring: String
        $sessionId: String
      ) {
        project: node(id: $id) {
          ... on Project {
            name
            description
            sessionCount(
              timeRange: $timeRange
              filterIoSubstring: $filterIoSubstring
              sessionId: $sessionId
            )
            averageSessionDurationMs(
              timeRange: $timeRange
              filterIoSubstring: $filterIoSubstring
              sessionId: $sessionId
            )
            averageTracesPerSession(
              timeRange: $timeRange
              filterIoSubstring: $filterIoSubstring
              sessionId: $sessionId
            )
            sessionDurationMsP50: sessionDurationMsQuantile(
              probability: 0.5
              timeRange: $timeRange
              filterIoSubstring: $filterIoSubstring
              sessionId: $sessionId
            )
            sessionDurationMsP99: sessionDurationMsQuantile(
              probability: 0.99
              timeRange: $timeRange
              filterIoSubstring: $filterIoSubstring
              sessionId: $sessionId
            )
            sessionAnnotationNames
          }
        }
      }
    `,
    {
      id: projectId,
      timeRange: timeRangeISOStrings,
      filterIoSubstring: filterIoSubstringOrSessionId,
      sessionId: filterIoSubstringOrSessionId,
    },
    { fetchKey, fetchPolicy: "store-and-network" }
  );

  const project = data?.project;
  const sessionAnnotationNames = getNonNoteAnnotationNames(
    project?.sessionAnnotationNames ?? []
  );

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
              <StatItem label="Total Sessions">
                <Text size="L" fontFamily="mono">
                  {intFormatter(project?.sessionCount)}
                </Text>
              </StatItem>
              <StatItem label="Avg Traces per Session">
                <Text size="L" fontFamily="mono">
                  {floatFormatter(project?.averageTracesPerSession)}
                </Text>
              </StatItem>
              <LatencyStatItem
                label="Avg Session Duration"
                latencyMs={project?.averageSessionDurationMs}
              />
              <LatencyStatItem
                label="Duration P50"
                latencyMs={project?.sessionDurationMsP50}
              />
              <LatencyStatItem
                label="Duration P99"
                latencyMs={project?.sessionDurationMsP99}
              />
            </Flex>
            {sessionAnnotationNames.length > 0 ? (
              <StatsSection title="Session Annotations">
                {sessionAnnotationNames.map((name) => (
                  <ErrorBoundary
                    key={name}
                    fallback={TextErrorBoundaryFallback}
                  >
                    <SessionAnnotationSummary
                      annotationName={name}
                      filterIoSubstringOrSessionId={
                        filterIoSubstringOrSessionId
                      }
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
