import { css } from "@emotion/react";
import type { ReactNode } from "react";
import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useState,
} from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Group } from "react-resizable-panels";

import { Flex, Text, View } from "@phoenix/components";
import { useCategoryChartColors } from "@phoenix/components/chart";
import { ErrorBoundary } from "@phoenix/components/exception/ErrorBoundary";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import type {
  EvaluationTarget,
  ProjectEvaluatorQueueStatsQuery,
  ProjectEvaluatorQueueStatsQuery$data,
} from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorQueueStatsQuery.graphql";
import {
  formatQueueCount,
  getClearableCount,
  MAX_QUEUE_COUNT,
} from "@phoenix/pages/project/evaluators/evaluationQueueCounts";
import {
  EvaluationQueueMeter,
  EvaluationQueueSwatch,
} from "@phoenix/pages/project/evaluators/EvaluationQueueMeter";
import {
  formatAddedPerHour,
  formatCompletedPerHour,
  getQueueStatusDetail,
  hasWaitedTooLong,
  HoverDetail,
  isLagWarning,
  QUEUE_METER_COLOR_BY_TARGET,
  QueueStatusBadge,
  StatValue,
} from "@phoenix/pages/project/evaluators/evaluationQueueStatParts";
import {
  formatElapsedShort,
  formatEvaluationTarget,
  formatLag,
} from "@phoenix/pages/project/evaluators/projectEvaluatorFormat";
import { StatItem } from "@phoenix/pages/project/TableAside";

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

/** A project's added and completed rates. */
type QueueRates = Pick<
  EvaluationQueue,
  "addedPerMinute" | "completedPerMinute"
>;

/**
 * The evaluators table's aside: this project's part of the server's
 * evaluation queue, beside the server queue's status. Span, trace, and session
 * evaluations of all projects share one queue, so another project's backlog
 * can slow this one.
 */
export function ProjectQueueAside({
  projectId,
  fetchKey,
  lastHour,
  action,
}: {
  projectId: string;
  /** From the page's queue stats poll. */
  fetchKey: string;
  lastHour: { start: string; end: string };
  /**
   * Shown under the stats, such as the button that clears the queue. Gets
   * how many of this project's queued evaluations clearing would remove, or
   * null while that is unknown.
   */
  action?: (clearableCount: number | null) => ReactNode;
}) {
  const [clearableCount, setClearableCount] = useState<number | null>(null);
  return (
    <Group orientation="vertical">
      <TitledPanel title="Evaluation Queue" headingLevel={2}>
        <View padding="size-200" overflow="auto" height="100%">
          <Flex
            direction="column"
            gap="size-200"
            alignItems="start"
            minWidth="size-2400"
          >
            <ErrorBoundary fallback={() => <QueueStatsPlaceholder />}>
              <Suspense fallback={<QueueStatsPlaceholder />}>
                <ProjectEvaluatorQueueStatsContent
                  projectId={projectId}
                  fetchKey={fetchKey}
                  lagTimeRange={lastHour}
                  onClearableCount={setClearableCount}
                />
              </Suspense>
            </ErrorBoundary>
            {action != null ? action(clearableCount) : null}
          </Flex>
        </View>
      </TitledPanel>
    </Group>
  );
}

function ProjectEvaluatorQueueStatsContent({
  projectId,
  fetchKey,
  lagTimeRange,
  onClearableCount,
}: {
  projectId: string;
  fetchKey: string;
  lagTimeRange: { start: string; end: string };
  onClearableCount: (clearableCount: number | null) => void;
}) {
  const data = useLazyLoadQuery<ProjectEvaluatorQueueStatsQuery>(
    graphql`
      query ProjectEvaluatorQueueStatsQuery(
        $projectId: ID!
        $lagTimeRange: TimeRange!
      ) {
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
            evaluationActivity(timeRange: $lagTimeRange) {
              lag {
                p95Seconds
              }
            }
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
    { projectId, lagTimeRange },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  const queue = data.evaluationQueue;
  const projectQueue = data.project?.evaluationQueue ?? null;
  const projectQueuedCount = projectQueue?.queuedCount ?? 0;
  // Clearing keeps running evaluations, so they are not counted as clearable.
  const clearableCount =
    projectQueue == null ? null : getClearableCount(projectQueue);
  useEffect(() => {
    onClearableCount(clearableCount);
  }, [clearableCount, onClearableCount]);
  return (
    <>
      <ServerQueueStatusStat queue={queue} />
      <ProjectQueuedStat
        queue={queue}
        projectId={projectId}
        projectTargets={projectQueue?.targets ?? []}
        projectQueuedCount={projectQueuedCount}
        projectRunningCount={projectQueue?.runningCount ?? 0}
      />
      <Flex direction="row" gap="size-400">
        <QueueRateStat
          label="Added per hour"
          rates={projectQueue}
          formatRate={(rates) => formatAddedPerHour(rates.addedPerMinute)}
          description="This project's evaluations added in the last hour"
        />
        <QueueRateStat
          label="Completed per hour"
          rates={projectQueue}
          formatRate={(rates) =>
            formatCompletedPerHour(rates.completedPerMinute)
          }
          description="This project's evaluations completed in the last hour"
        />
      </Flex>
      <ProjectLagStat
        lagP95Seconds={
          data.project?.evaluationActivity?.lag?.p95Seconds ?? null
        }
        projectOldestWaitingAt={projectQueue?.oldestWaitingAt ?? null}
      />
    </>
  );
}

/** The aside's shape while the queue loads, so the panel doesn't shift. */
function QueueStatsPlaceholder() {
  return (
    <>
      <StatItem label="Server queue">
        <StatValue>--</StatValue>
      </StatItem>
      <StatItem label="In queue">
        <StatValue>--</StatValue>
      </StatItem>
      <Flex direction="row" gap="size-400">
        <StatItem label="Added per hour">
          <StatValue>--</StatValue>
        </StatItem>
        <StatItem label="Completed per hour">
          <StatValue>--</StatValue>
        </StatItem>
      </Flex>
      <StatItem label="Lag p95, last hour">
        <StatValue>--</StatValue>
      </StatItem>
    </>
  );
}

function ServerQueueStatusStat({ queue }: { queue: EvaluationQueue }) {
  const detail = getQueueStatusDetail(queue);
  return (
    <StatItem label="Server queue">
      {/* The queue-wide figures live here: the other stats are this project's. */}
      <HoverDetail
        detail={
          <>
            {detail != null ? <Text size="S">{detail}</Text> : null}
            <Text size="S">
              {`All projects, per hour: ${formatAddedPerHour(queue.addedPerMinute)} added · ${formatCompletedPerHour(queue.completedPerMinute)} completed`}
            </Text>
            {queue.oldestWaitingAt != null ? (
              <Text size="S">{`All projects, longest wait: ${formatElapsedShort(queue.oldestWaitingAt)}`}</Text>
            ) : null}
          </>
        }
      >
        <QueueStatusBadge status={queue.status} />
      </HoverDetail>
    </StatItem>
  );
}

/** Other projects' share of the queue, one neutral section of the meter. */
const OTHER_PROJECTS_COLOR = "var(--global-color-gray-600)";

/**
 * Other projects' queued evaluations. At the server's limit the queue's total
 * no longer says how much is theirs, so the busiest other projects are summed.
 */
function getOtherProjectsQueued({
  queue,
  projectId,
  projectQueuedCount,
}: {
  queue: EvaluationQueue;
  projectId: string;
  projectQueuedCount: number;
}): number {
  if (queue.queuedCount < MAX_QUEUE_COUNT) {
    return Math.max(0, queue.queuedCount - projectQueuedCount);
  }
  return queue.projects
    .filter(({ project }) => project.id !== projectId)
    .reduce((sum, { queuedCount }) => sum + queuedCount, 0);
}

function ProjectQueuedStat({
  queue,
  projectId,
  projectTargets,
  projectQueuedCount,
  projectRunningCount,
}: {
  queue: EvaluationQueue;
  projectId: string;
  /** This project's queued evaluations of each kind. */
  projectTargets: ReadonlyArray<{
    evaluationTarget: EvaluationTarget;
    queuedCount: number;
  }>;
  projectQueuedCount: number;
  /** Running now, so clearing keeps them. */
  projectRunningCount: number;
}) {
  const colors = useCategoryChartColors();
  const otherProjectsQueued = getOtherProjectsQueued({
    queue,
    projectId,
    projectQueuedCount,
  });
  const segments = [
    ...projectTargets.map((target) => {
      const color =
        QUEUE_METER_COLOR_BY_TARGET[
          target.evaluationTarget as keyof typeof QUEUE_METER_COLOR_BY_TARGET
        ] ?? "category4";
      return {
        id: target.evaluationTarget,
        label: formatEvaluationTarget(target.evaluationTarget),
        count: target.queuedCount,
        color: colors[color],
      };
    }),
    {
      id: "OTHER_PROJECTS",
      label: "Other projects",
      count: otherProjectsQueued,
      color: OTHER_PROJECTS_COLOR,
    },
  ];
  return (
    <StatItem label="In queue">
      <Flex direction="column" gap="size-100" width="100%">
        <HoverDetail
          detail={
            queue.projects.length > 0 ? (
              <>
                <Text size="S" color="text-700">
                  Most queued
                </Text>
                {queue.projects.map(({ project, queuedCount }) => (
                  <Text key={project.id} size="S">
                    {`${project.name}${project.id === projectId ? " (this project)" : ""}: ${formatQueueCount(queuedCount)}`}
                  </Text>
                ))}
              </>
            ) : null
          }
        >
          <StatValue>{formatQueueCount(projectQueuedCount)}</StatValue>
        </HoverDetail>
        <EvaluationQueueMeter segments={segments} />
        <dl css={legendCSS}>
          {segments
            .filter((segment) => segment.count > 0)
            .map((segment) => (
              <div key={segment.id} className="queue-legend__row">
                <dt>
                  <EvaluationQueueSwatch color={segment.color} />
                  <Text size="XS" color="text-700">
                    {segment.label}
                  </Text>
                </dt>
                <dd>
                  <Text size="XS" fontFamily="mono">
                    {formatQueueCount(segment.count)}
                  </Text>
                </dd>
              </div>
            ))}
          {projectRunningCount > 0 ? (
            <div className="queue-legend__row">
              <dt>
                <Text size="XS" color="text-700">
                  Running now
                </Text>
              </dt>
              <dd>
                <Text size="XS" fontFamily="mono">
                  {formatQueueCount(projectRunningCount)}
                </Text>
              </dd>
            </div>
          ) : null}
        </dl>
      </Flex>
    </StatItem>
  );
}

function QueueRateStat({
  label,
  rates,
  formatRate,
  description,
}: {
  label: string;
  /** This project's rates, or null if the project couldn't be read. */
  rates: QueueRates | null;
  formatRate: (rates: QueueRates) => string;
  description: string;
}) {
  return (
    <StatItem label={label}>
      <HoverDetail
        detail={
          <Text size="S" color="text-700">
            {description}
          </Text>
        }
      >
        <StatValue>{rates != null ? formatRate(rates) : "--"}</StatValue>
      </HoverDetail>
    </StatItem>
  );
}

/**
 * How stale this project's results are: p95 time from added to completed over
 * the last hour. The longest wait now goes in the hover, since a stuck queue
 * completes nothing and so has no lag.
 */
function ProjectLagStat({
  lagP95Seconds,
  projectOldestWaitingAt,
}: {
  lagP95Seconds: number | null;
  projectOldestWaitingAt: string | null;
}) {
  const isWaitingTooLong =
    projectOldestWaitingAt != null && hasWaitedTooLong(projectOldestWaitingAt);
  const isLagging = lagP95Seconds != null && isLagWarning(lagP95Seconds);
  return (
    <StatItem label="Lag p95, last hour">
      <HoverDetail
        detail={
          <>
            <Text size="S" color="text-700">
              Added to completed
            </Text>
            <Text size="S" color={isWaitingTooLong ? "warning" : undefined}>
              {`Longest wait: ${projectOldestWaitingAt != null ? formatElapsedShort(projectOldestWaitingAt) : "none"}`}
            </Text>
          </>
        }
      >
        <StatValue color={isLagging || isWaitingTooLong ? "warning" : null}>
          {lagP95Seconds != null ? formatLag(lagP95Seconds) : "--"}
        </StatValue>
      </HoverDetail>
    </StatItem>
  );
}

const legendCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  margin: 0;
  width: 100%;
  .queue-legend__row {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    gap: var(--global-dimension-size-100);
  }
  dt {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-75);
  }
  dd {
    margin: 0;
  }
`;
