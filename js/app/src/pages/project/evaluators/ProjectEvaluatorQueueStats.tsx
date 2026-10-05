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
  action,
}: {
  projectId: string;
  /** Changes when the queue was changed from this page, to refetch at once. */
  refreshKey: number;
  /** Shown at the right end of the row, such as the button that clears the queue. */
  action?: ReactNode;
}) {
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
        gap="size-200"
      >
        <ErrorBoundary fallback={() => placeholder}>
          <Suspense fallback={placeholder}>
            <ProjectEvaluatorQueueStatsContent
              projectId={projectId}
              refreshKey={refreshKey}
            />
          </Suspense>
        </ErrorBoundary>
        {action != null ? (
          // An empty label keeps the action level with the values.
          <Stat label="">{action}</Stat>
        ) : null}
      </Flex>
    </View>
  );
}

function ProjectEvaluatorQueueStatsContent({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey: number;
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
      <QueueStatusStat queue={queue} />
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
function QueueStatsPlaceholder() {
  return (
    <Flex direction="row" gap="size-400" alignItems="start">
      <Stat label="Status" isStatus>
        <StatValue>--</StatValue>
      </Stat>
      <Stat label="Queued">
        <Flex direction="row" gap="size-100" alignItems="center">
          <div css={queuedCountCSS}>
            <StatValue>--</StatValue>
          </div>
          <EvaluationQueueMeter segments={[]} limit={1} />
        </Flex>
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

function QueueStatusStat({ queue }: { queue: EvaluationQueue }) {
  const badge = QUEUE_STATUS_BADGE[queue.status];
  const detail = getQueueStatusDetail(queue);
  return (
    <Stat label="Status" isStatus>
      <HoverDetail
        detail={detail != null ? <Text size="S">{detail}</Text> : null}
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

function QueuedStat({
  queue,
  projectQueuedCount,
}: {
  queue: EvaluationQueue;
  projectQueuedCount: number;
}) {
  const colors = useCategoryChartColors();
  const segments = queue.targets.map((target) => {
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
  });
  return (
    <Stat label="Queued">
      <HoverDetail
        detail={
          <>
            {segments.map((segment) => (
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
          <Flex
            direction="row"
            gap="size-50"
            alignItems="baseline"
            css={queuedCountCSS}
          >
            <StatValue color={queue.atCapacity ? "warning" : null}>
              {intFormatter(queue.queuedCount)}
            </StatValue>
            <Text size="S" color="text-700">
              {`/ ${intFormatter(queue.queuedLimit)}`}
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

/**
 * Wide enough for "10,000 / 10,000", so the bar and the stats after it stay put
 * as the count changes or loads.
 */
const queuedCountCSS = css`
  min-width: 140px;
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
}: {
  label: string;
  children: ReactNode;
  /** Reserves the width of the widest status badge. */
  isStatus?: boolean;
}) {
  return (
    <Flex
      direction="column"
      flex="none"
      css={isStatus ? statusColumnCSS : undefined}
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
