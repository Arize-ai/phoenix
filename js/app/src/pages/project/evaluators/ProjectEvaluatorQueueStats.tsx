import type { ReactNode } from "react";
import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useState,
} from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, Text } from "@phoenix/components";
import {
  useTimeRange,
  useTimeRangeSelectionKey,
} from "@phoenix/components/datetime";
import {
  ErrorBoundary,
  TextErrorBoundaryFallback,
} from "@phoenix/components/exception";
import type { ProjectEvaluatorQueueStatsCostQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorQueueStatsCostQuery.graphql";
import type {
  ProjectEvaluatorQueueStatsQuery,
  ProjectEvaluatorQueueStatsQuery$data,
} from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorQueueStatsQuery.graphql";
import {
  formatQueueCount,
  getClearableCount,
} from "@phoenix/pages/project/evaluators/evaluationQueueCounts";
import {
  formatAddedPerHour,
  formatCompletedPerHour,
  getNetPerHour,
  getQueueStatusDetail,
  HoverDetail,
  OldestWaitStat,
  QueueStatusBadge,
  StatValue,
  StatValueSkeleton,
} from "@phoenix/pages/project/evaluators/evaluationQueueStatParts";
import {
  EvaluationQueueStatsRow,
  EvaluationQueueStrip,
  QUEUE_STATUS_LEGEND,
} from "@phoenix/pages/project/evaluators/EvaluationQueueStrip";
import {
  formatElapsedShort,
  formatEvaluationTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorFormat";
import { useClosedTimeRange } from "@phoenix/pages/project/metrics/useClosedTimeRange";
import { StatItem } from "@phoenix/pages/project/TableAside";
import { costFormatter } from "@phoenix/utils/numberFormatUtils";

/**
 * Refetches the queue stats at once. Provided by the evaluators page, and
 * called after anything on it changes the queue: clearing it, or turning an
 * evaluator on or off.
 */
export const QueueStatsRefreshContext = createContext<(() => void) | null>(
  null
);

export function useRefreshQueueStats(): () => void {
  const refresh = useContext(QueueStatsRefreshContext);
  return refresh ?? noop;
}

function noop() {}

type EvaluationQueue = ProjectEvaluatorQueueStatsQuery$data["evaluationQueue"];

const STATUS_HELP = (
  <Flex direction="column" gap="size-100">
    <Text size="S">The status of the queue that all projects share.</Text>
    {QUEUE_STATUS_LEGEND}
  </Flex>
);

/**
 * The project evaluators tab's queue strip: this project's part of the
 * server's evaluation queue, beside the server queue's status. Span, trace,
 * and session evaluations of all projects share one queue, so another
 * project's backlog can slow this one. Reads the same as the server-wide
 * strip on the Evaluators page.
 */
export function ProjectEvaluationQueueStrip({
  projectId,
  fetchKey,
  renderActions,
}: {
  projectId: string;
  /** From the page's queue stats poll. */
  fetchKey: string;
  /**
   * The queue actions menu. Gets how many of this project's queued
   * evaluations clearing would remove, or null while that is unknown.
   */
  renderActions: (clearableCount: number | null) => ReactNode;
}) {
  const [clearableCount, setClearableCount] = useState<number | null>(null);
  return (
    <EvaluationQueueStrip
      fetchKey={fetchKey}
      actions={renderActions(clearableCount)}
    >
      <ProjectEvaluationQueueStripContent
        projectId={projectId}
        fetchKey={fetchKey}
        onClearableCount={setClearableCount}
      />
    </EvaluationQueueStrip>
  );
}

function ProjectEvaluationQueueStripContent({
  projectId,
  fetchKey,
  onClearableCount,
}: {
  projectId: string;
  fetchKey: string;
  onClearableCount: (clearableCount: number | null) => void;
}) {
  const { timeRangeISOStrings } = useTimeRange();
  const timeRangeSelectionKey = useTimeRangeSelectionKey();
  const data = useLazyLoadQuery<ProjectEvaluatorQueueStatsQuery>(
    graphql`
      query ProjectEvaluatorQueueStatsQuery($projectId: ID!) {
        evaluationQueue {
          status
          queuedCount
          oldestWaitingAt
          addedPerMinute
          completedPerMinute
          projects(first: 5) {
            project {
              id
              name
            }
            queuedCount
          }
        }
        project: node(id: $projectId) {
          ... on Project {
            evaluationQueue {
              queuedCount
              runningCount
              oldestWaitingAt
              addedPerMinute
              completedPerMinute
              targets {
                evaluationTarget
                queuedCount
              }
            }
            # Keeps the evaluators table's status and queued columns as fresh
            # as these stats: the rows share these records.
            evaluators(first: 100) {
              edges {
                node {
                  id
                  runSummary {
                    status
                    lastRunAt
                    queuedCount
                    runningCount
                    oldestWaitingOrRetryingAt
                  }
                }
              }
            }
          }
        }
      }
    `,
    { projectId },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  const queue = data.evaluationQueue;
  const projectQueue = data.project?.evaluationQueue ?? null;
  // Clearing keeps running evaluations, so they are not counted as clearable.
  const clearableCount =
    projectQueue == null ? null : getClearableCount(projectQueue);
  useEffect(() => {
    onClearableCount(clearableCount);
  }, [clearableCount, onClearableCount]);
  const net = projectQueue != null ? getNetPerHour(projectQueue) : null;
  return (
    <EvaluationQueueStatsRow>
      <ServerQueueStatusStat queue={queue} />
      <ProjectQueuedStat
        queue={queue}
        projectId={projectId}
        projectQueue={projectQueue}
      />
      <StatItem
        label="Added per hour"
        help="The number of this project's evaluations added to the queue in the last hour."
      >
        <StatValue>
          {projectQueue != null
            ? formatAddedPerHour(projectQueue.addedPerMinute)
            : "--"}
        </StatValue>
      </StatItem>
      <StatItem
        label="Completed per hour"
        help="The number of this project's evaluations completed in the last hour. This number includes evaluations that failed."
      >
        <StatValue>
          {projectQueue != null
            ? formatCompletedPerHour(projectQueue.completedPerMinute)
            : "--"}
        </StatValue>
      </StatItem>
      <StatItem
        label="Net per hour"
        help="The number of this project's evaluations added in the last hour, minus the number completed. If the number is more than 0, this project's part of the queue gets longer."
      >
        <StatValue color={net != null && net.netPerHour > 0 ? "warning" : null}>
          {net != null ? net.formatted : "--"}
        </StatValue>
      </StatItem>
      <OldestWaitStat
        oldestWaitingAt={projectQueue?.oldestWaitingAt ?? null}
        help="The longest time that one of this project's evaluations in the queue has waited to start. This time does not include evaluations that wait to retry. If this time is more than 10 minutes, the server queue is Degraded."
      />
      <StatItem
        label="Evaluation cost"
        help="The model cost of this project's evaluations that ran in the selected time range. Phoenix gets this cost from the evaluator traces. If tracing is off for an evaluator, its cost is not included."
      >
        {/* Cost reads a heavier request than the queue; its errors stay here. */}
        <ErrorBoundary
          resetKey={`${fetchKey} ${timeRangeISOStrings.start} ${timeRangeISOStrings.end}`}
          fallback={TextErrorBoundaryFallback}
        >
          <Suspense
            key={timeRangeSelectionKey}
            fallback={<StatValueSkeleton />}
          >
            <ProjectEvaluationCostValue
              projectId={projectId}
              fetchKey={fetchKey}
            />
          </Suspense>
        </ErrorBoundary>
      </StatItem>
    </EvaluationQueueStatsRow>
  );
}

function ServerQueueStatusStat({ queue }: { queue: EvaluationQueue }) {
  const detail = getQueueStatusDetail(queue);
  return (
    <StatItem label="Status" help={STATUS_HELP}>
      {/* The queue-wide figures live here: the other stats are this project's. */}
      <HoverDetail
        detail={
          <>
            {detail != null ? <Text size="S">{detail}</Text> : null}
            <Text size="S">
              {`All projects, per hour: ${formatAddedPerHour(
                queue.addedPerMinute
              )} added · ${formatCompletedPerHour(
                queue.completedPerMinute
              )} completed`}
            </Text>
            {queue.oldestWaitingAt != null ? (
              <Text size="S">{`All projects, oldest wait: ${formatElapsedShort(
                queue.oldestWaitingAt
              )}`}</Text>
            ) : null}
          </>
        }
      >
        <QueueStatusBadge status={queue.status} />
      </HoverDetail>
    </StatItem>
  );
}

type ProjectQueue = NonNullable<
  NonNullable<
    ProjectEvaluatorQueueStatsQuery$data["project"]
  >["evaluationQueue"]
>;

function ProjectQueuedStat({
  queue,
  projectId,
  projectQueue,
}: {
  queue: EvaluationQueue;
  projectId: string;
  /** Null if the project couldn't be read. */
  projectQueue: ProjectQueue | null;
}) {
  const queuedTargets = (projectQueue?.targets ?? []).filter(
    (target) => target.queuedCount > 0
  );
  const runningCount = projectQueue?.runningCount ?? 0;
  const hasDetail =
    queuedTargets.length > 0 || runningCount > 0 || queue.projects.length > 0;
  return (
    <StatItem
      label="In queue"
      help="The number of this project's evaluations that wait to start, are in progress, or wait to retry. All projects use the same server queue."
    >
      <HoverDetail
        detail={
          hasDetail ? (
            <Flex direction="column" gap="size-100">
              {queuedTargets.length > 0 || runningCount > 0 ? (
                <Flex direction="column" gap="size-25">
                  <Text size="S" color="text-700">
                    By kind
                  </Text>
                  {queuedTargets.map((target) => (
                    <Text key={target.evaluationTarget} size="S">
                      {`${formatEvaluationTarget(
                        target.evaluationTarget
                      )}: ${formatQueueCount(target.queuedCount)}`}
                    </Text>
                  ))}
                  {runningCount > 0 ? (
                    <Text size="S">{`Running now: ${formatQueueCount(
                      runningCount
                    )}`}</Text>
                  ) : null}
                </Flex>
              ) : null}
              {queue.projects.length > 0 ? (
                <Flex direction="column" gap="size-25">
                  <Text size="S" color="text-700">
                    Most queued
                  </Text>
                  {queue.projects.map(({ project, queuedCount }) => (
                    <Text key={project.id} size="S">
                      {`${project.name}${
                        project.id === projectId ? " (this project)" : ""
                      }: ${formatQueueCount(queuedCount)}`}
                    </Text>
                  ))}
                </Flex>
              ) : null}
            </Flex>
          ) : null
        }
      >
        <StatValue>
          {projectQueue != null
            ? formatQueueCount(projectQueue.queuedCount)
            : "--"}
        </StatValue>
      </HoverDetail>
    </StatItem>
  );
}

/** This project's evaluation cost over the selected range. */
function ProjectEvaluationCostValue({
  projectId,
  fetchKey,
}: {
  projectId: string;
  fetchKey: string;
}) {
  const timeRange = useClosedTimeRange();
  const data = useLazyLoadQuery<ProjectEvaluatorQueueStatsCostQuery>(
    graphql`
      query ProjectEvaluatorQueueStatsCostQuery(
        $projectId: ID!
        $timeRange: TimeRange!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            evaluationActivity(timeRange: $timeRange) {
              cost
              excludesUntracedEvaluators
            }
          }
        }
      }
    `,
    {
      projectId,
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
    },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  const activity = data.project?.evaluationActivity ?? null;
  return (
    <HoverDetail
      detail={
        activity?.excludesUntracedEvaluators ? (
          <Text size="S">Excludes evaluators with tracing off</Text>
        ) : null
      }
    >
      <StatValue>
        {activity?.cost != null ? costFormatter(activity.cost) : "--"}
      </StatValue>
    </HoverDetail>
  );
}
