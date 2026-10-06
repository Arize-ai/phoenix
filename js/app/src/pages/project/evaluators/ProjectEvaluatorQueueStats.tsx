import { css } from "@emotion/react";
import type { ReactNode } from "react";
import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useState,
} from "react";
import { Focusable } from "react-aria";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Group } from "react-resizable-panels";

import {
  Flex,
  RichTooltip,
  Text,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { useCategoryChartColors } from "@phoenix/components/chart";
import type { BadgeVariant } from "@phoenix/components/core/badge";
import { Badge } from "@phoenix/components/core/badge";
import { ErrorBoundary } from "@phoenix/components/exception/ErrorBoundary";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import type {
  EvaluationQueueStatus,
  ProjectEvaluatorQueueStatsQuery,
  ProjectEvaluatorQueueStatsQuery$data,
} from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorQueueStatsQuery.graphql";
import {
  EvaluationQueueMeter,
  EvaluationQueueSwatch,
} from "@phoenix/pages/project/evaluators/EvaluationQueueMeter";
import { formatElapsedShort } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { StatItem } from "@phoenix/pages/project/TableAside";
import { assertUnreachable } from "@phoenix/typeUtils";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

const REFRESH_INTERVAL_MS = 30_000;

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

/** The rates the queue reports, in total and for each evaluation target. */
type QueueRates = Pick<
  EvaluationQueue,
  "queuedPerMinute" | "evaluationsPerMinute"
>;

const QUEUE_LABEL_BY_TARGET: Record<string, string> = {
  SPAN: "Spans",
  TRACE: "Traces",
  SESSION: "Sessions",
};

function getQueueLabel(target: { evaluationTarget: string }): string {
  return (
    QUEUE_LABEL_BY_TARGET[target.evaluationTarget] ?? target.evaluationTarget
  );
}

const QUEUE_STATUS_BADGE: Record<
  EvaluationQueueStatus,
  { label: string; variant: BadgeVariant }
> = {
  HEALTHY: { label: "Healthy", variant: "success" },
  DEGRADED: { label: "Degraded", variant: "warning" },
  OVERLOADED: { label: "Overloaded", variant: "danger" },
};

function getQueueStatusDetails(queue: EvaluationQueue): string[] {
  switch (queue.status) {
    case "HEALTHY":
      return [];
    case "DEGRADED":
      return ["Evaluations are waiting more than 10 minutes"];
    case "OVERLOADED":
      return queue.targets
        .filter((target) => target.overflowedCount > 0)
        .map((target) =>
          target.overflowedCount === 1
            ? `${getQueueLabel(target)}: Dropped 1 evaluation in the last 10 minutes`
            : `${getQueueLabel(target)}: Dropped ${intFormatter(target.overflowedCount)} evaluations in the last 10 minutes`
        );
    default:
      return assertUnreachable(queue.status);
  }
}

/** A per-minute rate as a whole number per hour. */
function formatPerHour(perMinute: number): string {
  return intFormatter(Math.round(perMinute * 60));
}

/**
 * The evaluators table's aside: this project's share of the server's
 * evaluation queue, with the queue-wide figures behind the status. Span,
 * trace, and session evaluations of all projects share one queue and one
 * limit, so another project's backlog can slow this one.
 */
export function ProjectEvaluatorQueueAside({
  projectId,
  refreshKey,
  action,
}: {
  projectId: string;
  /** Changes when the queue was changed from this page, to refetch at once. */
  refreshKey: number;
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
                  refreshKey={refreshKey}
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
  refreshKey,
  onClearableCount,
}: {
  projectId: string;
  refreshKey: number;
  onClearableCount: (clearableCount: number | null) => void;
}) {
  const [pollKey, setPollKey] = useState(0);
  useEffect(() => {
    const interval = setInterval(
      () => setPollKey((key) => key + 1),
      REFRESH_INTERVAL_MS
    );
    return () => clearInterval(interval);
  }, []);
  const data = useLazyLoadQuery<ProjectEvaluatorQueueStatsQuery>(
    graphql`
      query ProjectEvaluatorQueueStatsQuery($projectId: ID!) {
        evaluationQueue {
          status
          atCapacity
          queuedCount
          queuedLimit
          retryingCount
          oldestQueuedAt
          queuedPerMinute
          evaluationsPerMinute
          runningCount
          projects(first: 5) {
            project {
              id
              name
            }
            queuedCount
          }
          targets {
            evaluationTarget
            queuedCount
            retryingCount
            oldestQueuedAt
            overflowedCount
            queuedPerMinute
            evaluationsPerMinute
          }
        }
        project: node(id: $projectId) {
          ... on Project {
            evaluationQueue {
              queuedCount
              runningCount
              oldestQueuedAt
              queuedPerMinute
              evaluationsPerMinute
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
                    oldestQueuedAt
                  }
                }
              }
            }
          }
        }
      }
    `,
    { projectId },
    { fetchKey: `${refreshKey}:${pollKey}`, fetchPolicy: "store-and-network" }
  );
  const queue = data.evaluationQueue;
  const projectQueue = data.project?.evaluationQueue ?? null;
  const projectQueuedCount = projectQueue?.queuedCount ?? 0;
  // Clearing keeps running evaluations, so they are not counted as clearable.
  const clearableCount =
    projectQueue == null
      ? null
      : projectQueue.queuedCount - projectQueue.runningCount;
  useEffect(() => {
    onClearableCount(clearableCount);
  }, [clearableCount, onClearableCount]);
  return (
    <>
      <QueueStatusStat queue={queue} />
      <QueuedStat
        queue={queue}
        projectId={projectId}
        projectTargets={projectQueue?.targets ?? []}
        projectQueuedCount={projectQueuedCount}
        projectRunningCount={projectQueue?.runningCount ?? 0}
      />
      <Flex direction="row" gap="size-400">
        <QueueRateStat
          label="Queued / hr"
          project={projectQueue}
          getPerMinute={(rates) => rates.queuedPerMinute}
          description="This project's evaluations queued in the last hour"
        />
        <QueueRateStat
          label="Completed / hr"
          project={projectQueue}
          getPerMinute={(rates) => rates.evaluationsPerMinute}
          description="This project's evaluations evaluated or failed in the last hour"
        />
      </Flex>
      <QueueWaitStat
        projectOldestQueuedAt={projectQueue?.oldestQueuedAt ?? null}
      />
    </>
  );
}

/** The aside's shape while the queue loads, so the panel doesn't shift. */
function QueueStatsPlaceholder() {
  return (
    <>
      <StatItem label="Status">
        <StatValue>--</StatValue>
      </StatItem>
      <StatItem label="In queue">
        <StatValue>--</StatValue>
      </StatItem>
      <Flex direction="row" gap="size-400">
        <StatItem label="Queued / hr">
          <StatValue>--</StatValue>
        </StatItem>
        <StatItem label="Completed / hr">
          <StatValue>--</StatValue>
        </StatItem>
      </Flex>
      <StatItem label="Waiting">
        <StatValue>--</StatValue>
      </StatItem>
    </>
  );
}

function QueueStatusStat({ queue }: { queue: EvaluationQueue }) {
  const badge = QUEUE_STATUS_BADGE[queue.status];
  const details = getQueueStatusDetails(queue);
  return (
    <StatItem label="Status">
      {/* The queue-wide figures live here: the other stats are this project's. */}
      <HoverDetail
        detail={
          <>
            {details.map((line) => (
              <Text key={line} size="S">
                {line}
              </Text>
            ))}
            <Text size="S">
              {`All projects, per hour: ${formatPerHour(queue.queuedPerMinute)} queued · ${formatPerHour(queue.evaluationsPerMinute)} completed`}
            </Text>
            {queue.oldestQueuedAt != null ? (
              <Text size="S">{`All projects, longest wait: ${formatElapsedShort(queue.oldestQueuedAt)}`}</Text>
            ) : null}
          </>
        }
      >
        <div css={badgeRowCSS}>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </HoverDetail>
    </StatItem>
  );
}

/** Each kind of evaluation's color in the queue meter and its legend. */
const QUEUE_METER_COLOR_BY_TARGET = {
  SPAN: "category1",
  TRACE: "category2",
  SESSION: "category3",
} as const;

/** Other projects' share of the queue, one neutral section of the meter. */
const OTHER_PROJECTS_COLOR = "var(--global-color-gray-600)";

function QueuedStat({
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
    evaluationTarget: string;
    queuedCount: number;
  }>;
  projectQueuedCount: number;
  /** Running now, so clearing keeps them. */
  projectRunningCount: number;
}) {
  const colors = useCategoryChartColors();
  const otherProjectsCount = Math.max(
    0,
    queue.queuedCount - projectQueuedCount
  );
  const segments = [
    ...projectTargets.map((target) => {
      const color =
        QUEUE_METER_COLOR_BY_TARGET[
          target.evaluationTarget as keyof typeof QUEUE_METER_COLOR_BY_TARGET
        ] ?? "category4";
      return {
        id: target.evaluationTarget,
        label: getQueueLabel(target),
        count: target.queuedCount,
        color: colors[color],
      };
    }),
    {
      id: "OTHER_PROJECTS",
      label: "Other projects",
      count: otherProjectsCount,
      color: OTHER_PROJECTS_COLOR,
    },
  ];
  return (
    <StatItem label="In queue">
      <Flex direction="column" gap="size-100" width="100%">
        <Flex direction="row" gap="size-75" alignItems="baseline">
          <StatValue>{intFormatter(projectQueuedCount)}</StatValue>
          <HoverDetail
            detail={
              queue.projects.length > 0 ? (
                <>
                  <Text size="S" color="text-700">
                    Most queued
                  </Text>
                  {queue.projects.map(({ project, queuedCount }) => (
                    <Text key={project.id} size="S">
                      {`${project.name}${project.id === projectId ? " (this project)" : ""}: ${intFormatter(queuedCount)}`}
                    </Text>
                  ))}
                </>
              ) : null
            }
          >
            <Text size="S" color={queue.atCapacity ? "warning" : "text-700"}>
              {`of ${intFormatter(queue.queuedCount)} / ${intFormatter(queue.queuedLimit)} shared`}
            </Text>
          </HoverDetail>
        </Flex>
        <EvaluationQueueMeter segments={segments} limit={queue.queuedLimit} />
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
                    {intFormatter(segment.count)}
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
                  {intFormatter(projectRunningCount)}
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
  project,
  getPerMinute,
  description,
}: {
  label: string;
  /** This project's rates, or null if the project couldn't be read. */
  project: QueueRates | null;
  getPerMinute: (rates: QueueRates) => number;
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
        <StatValue>
          {project != null ? formatPerHour(getPerMinute(project)) : "--"}
        </StatValue>
      </HoverDetail>
    </StatItem>
  );
}

/** How long an evaluation may wait before its queue counts as Degraded. */
const DEGRADED_WAIT_MS = 10 * 60_000;

function hasWaitedTooLong(since: string): boolean {
  return Date.now() - new Date(since).getTime() > DEGRADED_WAIT_MS;
}

function QueueWaitStat({
  projectOldestQueuedAt,
}: {
  projectOldestQueuedAt: string | null;
}) {
  const isWaitingTooLong =
    projectOldestQueuedAt != null && hasWaitedTooLong(projectOldestQueuedAt);
  return (
    <StatItem label="Waiting">
      <HoverDetail
        detail={
          <Text size="S" color="text-700">
            {"Longest wait, not counting retries"}
          </Text>
        }
      >
        <StatValue color={isWaitingTooLong ? "warning" : null}>
          {projectOldestQueuedAt != null
            ? formatElapsedShort(projectOldestQueuedAt)
            : "--"}
        </StatValue>
      </HoverDetail>
    </StatItem>
  );
}

/** The badge sits on the same line height as the mono values beside it. */
const badgeRowCSS = css`
  display: flex;
  align-items: center;
  min-height: var(--global-line-height-l);
`;

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

function StatValue({
  color = null,
  children,
}: {
  color?: "warning" | null;
  children: ReactNode;
}) {
  return (
    <Text size="L" fontFamily="mono" color={color ?? undefined}>
      {children}
    </Text>
  );
}

function HoverDetail({
  detail,
  children,
}: {
  /** Shown on hover; null for a value that needs no explanation. */
  detail: ReactNode;
  children: ReactNode;
}) {
  if (detail == null) {
    return children;
  }
  return (
    <TooltipTrigger delay={0}>
      <Focusable>
        <span role="button">{children}</span>
      </Focusable>
      {/* Sized to its lines, so a queue's line never wraps. */}
      <RichTooltip placement="bottom start" width="max-content">
        <TooltipArrow />
        <Flex direction="column" gap="size-50">
          {detail}
        </Flex>
      </RichTooltip>
    </TooltipTrigger>
  );
}
