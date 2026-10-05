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

type EvaluationQueue = ProjectEvaluatorQueueStatsQuery$data["evaluationQueue"];

type EvaluationQueueTarget = EvaluationQueue["targets"][number];

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

function getQueueLabel(target: EvaluationQueueTarget): string {
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
 * The health of the server's evaluation queue, as one row of stats above the
 * evaluators table. The whole queue is included: span, trace, and session
 * evaluations of all projects share it and its limit, and all project
 * evaluators run under one concurrency limit, so any backlog slows the rest.
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
        evaluationQueue {
          status
          atCapacity
          queuedCount
          queuedLimit
          retryingCount
          oldestQueuedAt
          queuedPerMinute
          evaluationsPerMinute
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
  const queue = data.evaluationQueue;
  const projectQueuedCount = sum(
    (data.project?.evaluators?.edges ?? []).map(
      ({ node }) => node.runSummary.queuedCount
    )
  );
  return (
    <Flex direction="row" gap="size-400" alignItems="start">
      <QueueStatusStat queue={queue} statusAction={statusAction} />
      <QueuedStat queue={queue} projectQueuedCount={projectQueuedCount} />
      <QueueRateStat
        label="Added"
        queue={queue}
        getPerMinute={(rates) => rates.queuedPerMinute}
        description="In the last hour"
      />
      <QueueRateStat
        label="Completed"
        queue={queue}
        getPerMinute={(rates) => rates.evaluationsPerMinute}
        description="Evaluated or failed, in the last hour"
      />
      <QueueWaitStat queue={queue} />
    </Flex>
  );
}

/** The strip's shape while the queue loads, so the page doesn't shift. */
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
  queue,
  statusAction,
}: {
  queue: EvaluationQueue;
  statusAction: ReactNode;
}) {
  const badge = QUEUE_STATUS_BADGE[queue.status];
  const detail = getQueueStatusDetail(queue);
  return (
    <Stat label="Status">
      <Flex direction="row" gap="size-100" alignItems="center">
        <HoverDetail
          detail={detail != null ? <Text size="S">{detail}</Text> : null}
        >
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </HoverDetail>
        {statusAction}
      </Flex>
    </Stat>
  );
}

function QueuedStat({
  queue,
  projectQueuedCount,
}: {
  queue: EvaluationQueue;
  projectQueuedCount: number;
}) {
  return (
    <Stat label="Queued">
      <HoverDetail
        detail={
          <>
            {queue.targets.map((target) => (
              <Text key={target.evaluationTarget} size="S">
                {`${getQueueLabel(target)}: ${intFormatter(target.queuedCount)}`}
              </Text>
            ))}
            <Text size="S">{`Limit: ${intFormatter(queue.queuedLimit)}`}</Text>
            <Text size="S">{`This project: ${intFormatter(projectQueuedCount)}`}</Text>
            {queue.retryingCount > 0 ? (
              <Text size="S">{`Retrying: ${intFormatter(queue.retryingCount)}`}</Text>
            ) : null}
            <Text size="S" color="text-700">
              Shared by all projects
            </Text>
          </>
        }
      >
        <Flex direction="row" gap="size-100" alignItems="center">
          <StatValue color={queue.atCapacity ? "warning" : null}>
            {intFormatter(queue.queuedCount)}
          </StatValue>
          <Flex direction="column" gap="size-25">
            {queue.targets.map((target) => (
              <span
                key={target.evaluationTarget}
                css={queue.atCapacity ? fullMeterCSS : undefined}
              >
                <ProgressBar
                  width="80px"
                  height="4px"
                  value={Math.min(target.queuedCount, queue.queuedLimit)}
                  maxValue={queue.queuedLimit}
                  aria-label={`How much of the queue ${getQueueLabel(target).toLowerCase()} take up`}
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
  queue,
  getPerMinute,
  description,
}: {
  label: string;
  queue: EvaluationQueue;
  getPerMinute: (rates: QueueRates) => number;
  description: string;
}) {
  return (
    <Stat label={label}>
      <HoverDetail
        detail={
          <>
            {queue.targets.map((target) => (
              <Text key={target.evaluationTarget} size="S">
                {`${getQueueLabel(target)}: ${formatPerHour(getPerMinute(target))}`}
              </Text>
            ))}
            <Text size="S" color="text-700">
              {description}
            </Text>
          </>
        }
      >
        <Flex direction="row" gap="size-50" alignItems="baseline">
          <StatValue>{formatPerHour(getPerMinute(queue))}</StatValue>
          <Text size="S" color="text-700">
            per hour
          </Text>
        </Flex>
      </HoverDetail>
    </Stat>
  );
}

function QueueWaitStat({ queue }: { queue: EvaluationQueue }) {
  const waiting = queue.targets.filter(
    (target): target is EvaluationQueueTarget & { oldestQueuedAt: string } =>
      target.oldestQueuedAt != null
  );
  // A full queue is Degraded too, but that shows on the queued count instead.
  const isWaitingTooLong = queue.status === "DEGRADED" && !queue.atCapacity;
  return (
    <Stat label="Waiting">
      <HoverDetail
        detail={
          <>
            {waiting.map((target) => (
              <Text key={target.evaluationTarget} size="S">
                {`${getQueueLabel(target)}: ${formatElapsedShort(target.oldestQueuedAt)}`}
              </Text>
            ))}
            <Text size="S" color="text-700">
              Longest wait of an evaluation not yet started
            </Text>
          </>
        }
      >
        <StatValue color={isWaitingTooLong ? "warning" : null}>
          {queue.oldestQueuedAt != null
            ? formatElapsedShort(queue.oldestQueuedAt)
            : "--"}
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
