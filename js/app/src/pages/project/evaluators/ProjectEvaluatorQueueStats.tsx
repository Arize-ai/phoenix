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
};

function getQueueStatusDetail(queue: EvaluationQueue): string | null {
  switch (queue.status) {
    case "HEALTHY":
      return null;
    case "DEGRADED":
      return queue.atCapacity
        ? "Queue is full; new evaluations wait to be queued"
        : "Evaluations are waiting more than 10 minutes";
    default:
      return assertUnreachable(queue.status);
  }
}

/** A per-minute rate as a whole number per hour. */
function formatPerHour(perMinute: number): string {
  return intFormatter(Math.round(perMinute * 60));
}

/**
 * The health of the server's evaluation queue, as one row of stats above the
 * evaluators table. The whole queue is included: span, trace, and session
 * evaluations of all projects share it and its limit, and all project
 * evaluators run under one concurrency limit, so any backlog slows the rest.
 */
export function ProjectEvaluatorQueueStats({
  projectId,
  refreshKey,
  action,
}: {
  projectId: string;
  /** Changes when the queue was changed from this page, to refetch at once. */
  refreshKey: number;
  /**
   * Shown at the right end of the row, such as the button that clears the
   * queue. Gets how many of this project's queued evaluations clearing would
   * remove, or null while that is unknown.
   */
  action?: (clearableCount: number | null) => ReactNode;
}) {
  const [clearableCount, setClearableCount] = useState<number | null>(null);
  const placeholder = <QueueStatsPlaceholder />;
  return (
    <View
      paddingX="size-200"
      paddingY="size-100"
      borderBottomWidth="thin"
      borderBottomColor="default"
      flex="none"
    >
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="start"
        wrap="wrap"
        columnGap="size-200"
        rowGap="size-100"
      >
        <ErrorBoundary fallback={() => placeholder}>
          <Suspense fallback={placeholder}>
            <ProjectEvaluatorQueueStatsContent
              projectId={projectId}
              refreshKey={refreshKey}
              onClearableCount={setClearableCount}
            />
          </Suspense>
        </ErrorBoundary>
        {action != null ? (
          // An empty label keeps the action level with the values.
          <div css={actionCSS}>
            <Stat label="">{action(clearableCount)}</Stat>
          </div>
        ) : null}
      </Flex>
    </View>
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
    <Flex
      direction="row"
      alignItems="start"
      wrap="wrap"
      columnGap="size-400"
      rowGap="size-100"
    >
      <QueueStatusStat queue={queue} />
      <QueuedStat
        queue={queue}
        projectId={projectId}
        projectTargets={projectQueue?.targets ?? []}
        projectQueuedCount={projectQueuedCount}
        projectRunningCount={projectQueue?.runningCount ?? 0}
      />
      <QueueRateStat
        label="Queued per hour"
        project={projectQueue}
        getPerMinute={(rates) => rates.queuedPerMinute}
        description="This project, in the last hour"
      />
      <QueueRateStat
        label="Completed per hour"
        project={projectQueue}
        getPerMinute={(rates) => rates.evaluationsPerMinute}
        description="This project's evaluated or failed, in the last hour"
      />
      <QueueWaitStat
        projectOldestQueuedAt={projectQueue?.oldestQueuedAt ?? null}
      />
    </Flex>
  );
}

/** The strip's shape while the queue loads, so the page doesn't shift. */
function QueueStatsPlaceholder() {
  return (
    <Flex
      direction="row"
      alignItems="start"
      wrap="wrap"
      columnGap="size-400"
      rowGap="size-100"
    >
      <Stat label="Status" isStatus>
        <StatValue>--</StatValue>
      </Stat>
      <Stat label="In queue" isInQueue>
        <Flex direction="row" gap="size-100" alignItems="center">
          <StatValue>--</StatValue>
          <EvaluationQueueMeter segments={[]} limit={1} />
        </Flex>
      </Stat>
      <Stat label="Queued per hour">
        <StatValue>--</StatValue>
      </Stat>
      <Stat label="Completed per hour">
        <StatValue>--</StatValue>
      </Stat>
      <Stat label="Waiting">
        <StatValue>--</StatValue>
      </Stat>
    </Flex>
  );
}

function QueueStatusStat({ queue }: { queue: EvaluationQueue }) {
  const badge = QUEUE_STATUS_BADGE[queue.status];
  const detail = getQueueStatusDetail(queue);
  return (
    <Stat label="Status" isStatus>
      {/* The queue-wide figures live here: the other stats are this project's. */}
      <HoverDetail
        detail={
          <>
            {detail != null ? <Text size="S">{detail}</Text> : null}
            <Text size="S">
              {`All projects, per hour: ${formatPerHour(queue.queuedPerMinute)} queued · ${formatPerHour(queue.evaluationsPerMinute)} completed`}
            </Text>
            {queue.oldestQueuedAt != null ? (
              <Text size="S">{`All projects, longest wait: ${formatElapsedShort(queue.oldestQueuedAt)}`}</Text>
            ) : null}
          </>
        }
      >
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </HoverDetail>
    </Stat>
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
    <Stat label="In queue" isInQueue>
      <HoverDetail
        detail={
          <>
            {segments
              .filter((segment) => segment.count > 0)
              .map((segment) => (
                <Flex
                  key={segment.id}
                  direction="row"
                  gap="size-75"
                  alignItems="center"
                >
                  <EvaluationQueueSwatch color={segment.color} />
                  <Text size="S">{`${segment.label}: ${intFormatter(segment.count)}`}</Text>
                </Flex>
              ))}
            {projectRunningCount > 0 ? (
              <Text size="S">{`Running now: ${intFormatter(projectRunningCount)}`}</Text>
            ) : null}
            {queue.projects.length > 0 ? (
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
            ) : null}
          </>
        }
      >
        <Flex direction="row" gap="size-100" alignItems="center">
          <Flex direction="row" gap="size-75" alignItems="baseline">
            <StatValue>{intFormatter(projectQueuedCount)}</StatValue>
            <Text size="S" color={queue.atCapacity ? "warning" : "text-700"}>
              {`· ${intFormatter(queue.queuedCount)} / ${intFormatter(queue.queuedLimit)} shared`}
            </Text>
          </Flex>
          <EvaluationQueueMeter segments={segments} limit={queue.queuedLimit} />
        </Flex>
      </HoverDetail>
    </Stat>
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
    <Stat label={label}>
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
    </Stat>
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
    <Stat label="Waiting">
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
    </Stat>
  );
}

/**
 * Wide enough for typical counts ("120 · 4,800 / 10,000 shared") and the bar,
 * so the stats after it stay put as the counts change or load.
 */
const inQueueColumnCSS = css`
  min-width: 300px;
`;

/** Keeps the action at the right edge, also when the row wraps. */
const actionCSS = css`
  margin-inline-start: auto;
`;

/** Wide enough for the widest status badge, so the stats beside it never shift. */
const statusColumnCSS = css`
  min-width: 88px;
`;

/** The value row is one large line tall, so a badge or button centers on it. */
const statValueRowCSS = css`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  min-height: var(--global-line-height-l);
`;

function Stat({
  label,
  children,
  isStatus = false,
  isInQueue = false,
}: {
  label: string;
  children: ReactNode;
  /** Reserves the width of the widest status badge. */
  isStatus?: boolean;
  /** Reserves the width of the widest queue counts and the bar. */
  isInQueue?: boolean;
}) {
  return (
    <Flex
      direction="column"
      flex="none"
      css={
        isStatus ? statusColumnCSS : isInQueue ? inQueueColumnCSS : undefined
      }
    >
      <Text elementType="h3" size="S" color="text-700">
        {/* A non-breaking space keeps an unlabeled column's rows aligned. */}
        {label || "\u00a0"}
      </Text>
      <div css={statValueRowCSS}>{children}</div>
    </Flex>
  );
}

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
      {/* Extends right from its stat, so it never covers the stats to its left. */}
      <RichTooltip placement="bottom start" width="max-content">
        <TooltipArrow />
        <Flex direction="column" gap="size-50">
          {detail}
        </Flex>
      </RichTooltip>
    </TooltipTrigger>
  );
}
