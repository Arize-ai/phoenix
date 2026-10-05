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
  ProgressBar,
  RichTooltip,
  Text,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import type { BadgeVariant } from "@phoenix/components/core/badge";
import { Badge } from "@phoenix/components/core/badge";
import { ErrorBoundary } from "@phoenix/components/exception/ErrorBoundary";
import type {
  EvaluationQueueStatus,
  ProjectEvaluatorQueueStatsQuery,
  ProjectEvaluatorQueueStatsQuery$data,
} from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorQueueStatsQuery.graphql";
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

type EvaluationQueue =
  ProjectEvaluatorQueueStatsQuery$data["evaluationQueues"][number];

/** The order the queues are listed in on hover. */
const QUEUE_ORDER_BY_TARGET: Record<string, number> = {
  SPAN: 0,
  TRACE: 1,
  SESSION: 2,
};

const QUEUE_LABEL_BY_TARGET: Record<string, string> = {
  SPAN: "Spans",
  TRACE: "Traces",
  SESSION: "Sessions",
};

function getQueueLabel(queue: EvaluationQueue): string {
  return (
    QUEUE_LABEL_BY_TARGET[queue.evaluationTarget] ?? queue.evaluationTarget
  );
}

const QUEUE_STATUS_BADGE: Record<
  EvaluationQueueStatus,
  { label: string; variant: BadgeVariant }
> = {
  HEALTHY: { label: "Healthy", variant: "success" },
  DEGRADED: { label: "Degraded", variant: "warning" },
};

/** How serious each status is, so the strip shows the worst queue's. */
const QUEUE_STATUS_SEVERITY: Record<EvaluationQueueStatus, number> = {
  HEALTHY: 0,
  DEGRADED: 1,
};

const RECORD_NOUN_BY_TARGET: Record<string, string> = {
  SPAN: "spans",
  TRACE: "traces",
  SESSION: "sessions",
};

function getQueueStatusDetail(queue: EvaluationQueue): string | null {
  switch (queue.status) {
    case "HEALTHY":
      return null;
    case "DEGRADED":
      return queue.atCapacity
        ? `Queue is full; new ${RECORD_NOUN_BY_TARGET[queue.evaluationTarget] ?? "records"} wait to be queued`
        : "Evaluations are waiting more than 10 minutes";
    default:
      return assertUnreachable(queue.status);
  }
}

/** Fills the meter in the warning color once the queue is full. */
const fullMeterCSS = css`
  --mod-barloader-fill-color: var(--global-color-warning);
`;

/** A per-minute rate as a whole number per hour. */
function formatPerHour(perMinute: number): string {
  return intFormatter(Math.round(perMinute * 60));
}

function sum(values: ReadonlyArray<number>): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * The health of the server's evaluation queues, as one row of stats above the
 * evaluators table. Every queue is included: they are shared by all projects,
 * and all project evaluators run under one concurrency limit, so any queue
 * that backs up slows the rest.
 */
export function ProjectEvaluatorQueueStats({
  projectId,
  refreshKey,
  statusAction,
}: {
  projectId: string;
  /** Changes when the queue was changed from this page, to refetch at once. */
  refreshKey: number;
  /** Shown beside the status, such as the button that clears the queue. */
  statusAction?: ReactNode;
}) {
  const placeholder = <QueueStatsPlaceholder statusAction={statusAction} />;
  return (
    <View
      paddingX="size-200"
      paddingY="size-100"
      borderBottomWidth="thin"
      borderBottomColor="default"
      flex="none"
    >
      <ErrorBoundary fallback={() => placeholder}>
        <Suspense fallback={placeholder}>
          <ProjectEvaluatorQueueStatsContent
            projectId={projectId}
            refreshKey={refreshKey}
            statusAction={statusAction}
          />
        </Suspense>
      </ErrorBoundary>
    </View>
  );
}

function ProjectEvaluatorQueueStatsContent({
  projectId,
  refreshKey,
  statusAction,
}: {
  projectId: string;
  refreshKey: number;
  statusAction?: ReactNode;
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
        evaluationQueues {
          evaluationTarget
          status
          atCapacity
          queuedCount
          queuedLimit
          retryingCount
          oldestQueuedAt
          queuedPerMinute
          evaluationsPerMinute
        }
        project: node(id: $projectId) {
          ... on Project {
            evaluators(first: 100) {
              edges {
                node {
                  runSummary {
                    queuedCount
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
  const queues = [...data.evaluationQueues].sort(
    (a, b) =>
      (QUEUE_ORDER_BY_TARGET[a.evaluationTarget] ?? Infinity) -
      (QUEUE_ORDER_BY_TARGET[b.evaluationTarget] ?? Infinity)
  );
  const projectQueuedCount = sum(
    (data.project?.evaluators?.edges ?? []).map(
      ({ node }) => node.runSummary.queuedCount
    )
  );
  return (
    <Flex direction="row" gap="size-400" alignItems="start">
      <QueueStatusStat queues={queues} statusAction={statusAction} />
      <QueuedStat queues={queues} projectQueuedCount={projectQueuedCount} />
      <QueueRateStat
        label="Added"
        queues={queues}
        getPerMinute={(queue) => queue.queuedPerMinute}
        description="In the last hour"
      />
      <QueueRateStat
        label="Completed"
        queues={queues}
        getPerMinute={(queue) => queue.evaluationsPerMinute}
        description="Evaluated or failed, in the last hour"
      />
      <QueueWaitStat queues={queues} />
    </Flex>
  );
}

/** The strip's shape while the queues load, so the page doesn't shift. */
function QueueStatsPlaceholder({ statusAction }: { statusAction: ReactNode }) {
  return (
    <Flex direction="row" gap="size-400" alignItems="start">
      <Stat label="Status">
        <Flex direction="row" gap="size-100" alignItems="center">
          <StatValue>--</StatValue>
          {statusAction}
        </Flex>
      </Stat>
      <Stat label="Queued">
        <StatValue>--</StatValue>
      </Stat>
      <Stat label="Added">
        <StatValue>--</StatValue>
      </Stat>
      <Stat label="Completed">
        <StatValue>--</StatValue>
      </Stat>
      <Stat label="Waiting">
        <StatValue>--</StatValue>
      </Stat>
    </Flex>
  );
}

function QueueStatusStat({
  queues,
  statusAction,
}: {
  queues: ReadonlyArray<EvaluationQueue>;
  statusAction: ReactNode;
}) {
  const status = queues.reduce<EvaluationQueueStatus>(
    (worst, queue) =>
      QUEUE_STATUS_SEVERITY[queue.status] > QUEUE_STATUS_SEVERITY[worst]
        ? queue.status
        : worst,
    "HEALTHY"
  );
  const badge = QUEUE_STATUS_BADGE[status];
  const details = queues.flatMap((queue) => {
    const detail = getQueueStatusDetail(queue);
    return detail == null ? [] : [`${getQueueLabel(queue)}: ${detail}`];
  });
  return (
    <Stat label="Status">
      <Flex direction="row" gap="size-100" alignItems="center">
        <HoverDetail
          detail={
            details.length > 0
              ? details.map((line) => (
                  <Text key={line} size="S">
                    {line}
                  </Text>
                ))
              : null
          }
        >
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </HoverDetail>
        {statusAction}
      </Flex>
    </Stat>
  );
}

function QueuedStat({
  queues,
  projectQueuedCount,
}: {
  queues: ReadonlyArray<EvaluationQueue>;
  projectQueuedCount: number;
}) {
  const retryingCount = sum(queues.map((queue) => queue.retryingCount));
  return (
    <Stat label="Queued">
      <HoverDetail
        detail={
          <>
            {queues.map((queue) => (
              <Text key={queue.evaluationTarget} size="S">
                {`${getQueueLabel(queue)}: ${intFormatter(queue.queuedCount)} / ${intFormatter(queue.queuedLimit)}`}
              </Text>
            ))}
            <Text size="S">{`This project: ${intFormatter(projectQueuedCount)}`}</Text>
            {retryingCount > 0 ? (
              <Text size="S">{`Retrying: ${intFormatter(retryingCount)}`}</Text>
            ) : null}
            <Text size="S" color="text-700">
              Shared by all projects
            </Text>
          </>
        }
      >
        <Flex direction="row" gap="size-100" alignItems="center">
          <StatValue
            color={queues.some((queue) => queue.atCapacity) ? "warning" : null}
          >
            {intFormatter(sum(queues.map((queue) => queue.queuedCount)))}
          </StatValue>
          <Flex direction="column" gap="size-25">
            {queues.map((queue) => (
              <span
                key={queue.evaluationTarget}
                css={queue.atCapacity ? fullMeterCSS : undefined}
              >
                <ProgressBar
                  width="80px"
                  height="4px"
                  value={Math.min(queue.queuedCount, queue.queuedLimit)}
                  maxValue={queue.queuedLimit}
                  aria-label={`How full the ${getQueueLabel(queue).toLowerCase()} queue is`}
                />
              </span>
            ))}
          </Flex>
        </Flex>
      </HoverDetail>
    </Stat>
  );
}

function QueueRateStat({
  label,
  queues,
  getPerMinute,
  description,
}: {
  label: string;
  queues: ReadonlyArray<EvaluationQueue>;
  getPerMinute: (queue: EvaluationQueue) => number;
  description: string;
}) {
  return (
    <Stat label={label}>
      <HoverDetail
        detail={
          <>
            {queues.map((queue) => (
              <Text key={queue.evaluationTarget} size="S">
                {`${getQueueLabel(queue)}: ${formatPerHour(getPerMinute(queue))}`}
              </Text>
            ))}
            <Text size="S" color="text-700">
              {description}
            </Text>
          </>
        }
      >
        <Flex direction="row" gap="size-50" alignItems="baseline">
          <StatValue>{formatPerHour(sum(queues.map(getPerMinute)))}</StatValue>
          <Text size="S" color="text-700">
            per hour
          </Text>
        </Flex>
      </HoverDetail>
    </Stat>
  );
}

function QueueWaitStat({ queues }: { queues: ReadonlyArray<EvaluationQueue> }) {
  const waiting = queues.filter(
    (queue): queue is EvaluationQueue & { oldestQueuedAt: string } =>
      queue.oldestQueuedAt != null
  );
  const oldestQueuedAt = waiting.reduce<string | null>(
    (oldest, queue) =>
      oldest == null ||
      new Date(queue.oldestQueuedAt).getTime() < new Date(oldest).getTime()
        ? queue.oldestQueuedAt
        : oldest,
    null
  );
  // A full queue is Degraded too, but that shows on the queued count instead.
  const isWaitingTooLong = queues.some(
    (queue) => queue.status === "DEGRADED" && !queue.atCapacity
  );
  return (
    <Stat label="Waiting">
      <HoverDetail
        detail={
          <>
            {waiting.map((queue) => (
              <Text key={queue.evaluationTarget} size="S">
                {`${getQueueLabel(queue)}: ${formatElapsedShort(queue.oldestQueuedAt)}`}
              </Text>
            ))}
            <Text size="S" color="text-700">
              Longest wait of an evaluation not yet started
            </Text>
          </>
        }
      >
        <StatValue color={isWaitingTooLong ? "warning" : null}>
          {oldestQueuedAt != null ? formatElapsedShort(oldestQueuedAt) : "--"}
        </StatValue>
      </HoverDetail>
    </Stat>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Flex direction="column" flex="none">
      <Text elementType="h3" size="S" color="text-700">
        {label}
      </Text>
      {children}
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
      <RichTooltip placement="bottom" width="max-content">
        <TooltipArrow />
        <Flex direction="column" gap="size-50">
          {detail}
        </Flex>
      </RichTooltip>
    </TooltipTrigger>
  );
}
