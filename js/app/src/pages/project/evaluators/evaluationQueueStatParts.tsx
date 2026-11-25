import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { startTransition, useState } from "react";
import { Focusable } from "react-aria";

import {
  Flex,
  RichTooltip,
  Skeleton,
  Text,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import type { BadgeVariant } from "@phoenix/components/core/badge";
import { Badge } from "@phoenix/components/core/badge";
import { useInterval } from "@phoenix/hooks/useInterval";
import {
  formatQueueCount,
  MAX_QUEUE_COUNT,
} from "@phoenix/pages/project/evaluators/evaluationQueueCounts";
import { formatElapsedShort } from "@phoenix/pages/project/evaluators/projectEvaluatorFormat";
import { StatItem } from "@phoenix/pages/project/TableAside";
import { assertUnreachable } from "@phoenix/typeUtils";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

/**
 * Pieces shared by the project evaluators strip and the server-wide project
 * evaluators strip, so both read the queue the same way.
 */

export type EvaluationQueueStatusValue = "HEALTHY" | "DEGRADED";

const QUEUE_STATS_POLL_INTERVAL_MS = 30_000;

/** A minute between chart polls, less half a poll for timer drift. */
const CHART_POLL_MIN_INTERVAL_MS = QUEUE_STATS_POLL_INTERVAL_MS * 1.5;

/**
 * Polls the queue stats: `fetchKey` changes on every poll or refresh, and
 * `throttledFetchKey` on a poll at least a minute after its last change, or
 * on a refresh, for charts that read the whole time range. Call it once per
 * page, so the stats and charts refresh together. Paused while `isPolling` is
 * false or the page is hidden; a refresh still changes the keys. When the
 * page is shown again while polling, it polls once. A server-side cache of
 * the charts' aggregates would let them poll with the stats and remove the
 * throttled key.
 */
export function useQueueStatsPoll({
  refreshKey,
  isPolling = true,
}: {
  refreshKey: string | number;
  isPolling?: boolean;
}) {
  const [polls, setPolls] = useState(() => ({
    pollCount: 0,
    chartPollCount: 0,
    chartPolledAtMs: Date.now(),
  }));
  useInterval(
    () => {
      const nowMs = Date.now();
      // Keep the current stats up while the next poll loads.
      startTransition(() =>
        setPolls((current) => {
          const isChartPollDue =
            nowMs - current.chartPolledAtMs >= CHART_POLL_MIN_INTERVAL_MS;
          return isChartPollDue
            ? {
                pollCount: current.pollCount + 1,
                chartPollCount: current.chartPollCount + 1,
                chartPolledAtMs: nowMs,
              }
            : { ...current, pollCount: current.pollCount + 1 };
        })
      );
    },
    isPolling ? QUEUE_STATS_POLL_INTERVAL_MS : null
  );
  return {
    fetchKey: `${refreshKey}:${polls.pollCount}`,
    throttledFetchKey: `${refreshKey}:${polls.chartPollCount}`,
  };
}

const QUEUE_STATUS_BADGE: Record<
  EvaluationQueueStatusValue,
  { label: string; variant: BadgeVariant }
> = {
  HEALTHY: { label: "Healthy", variant: "success" },
  DEGRADED: { label: "Degraded", variant: "warning" },
};

export function getQueueStatusDetail(queue: {
  status: EvaluationQueueStatusValue;
}): string | null {
  switch (queue.status) {
    case "HEALTHY":
      return null;
    case "DEGRADED":
      return "Evaluations are waiting more than 10 minutes";
    default:
      return assertUnreachable(queue.status);
  }
}

export function QueueStatusBadge({
  status,
}: {
  status: EvaluationQueueStatusValue;
}) {
  const badge = QUEUE_STATUS_BADGE[status];
  return (
    <div css={badgeRowCSS}>
      <Badge variant={badge.variant}>{badge.label}</Badge>
    </div>
  );
}

/** Evaluations added per hour, from the per-minute rate; a queue count. */
export function formatAddedPerHour(addedPerMinute: number): string {
  return formatQueueCount(Math.round(addedPerMinute * 60));
}

/** Evaluations completed per hour, from the per-minute rate. */
export function formatCompletedPerHour(completedPerMinute: number): string {
  return intFormatter(Math.round(completedPerMinute * 60));
}

/**
 * Added minus completed per hour, signed. Once the added rate is at the queue
 * count limit the net is a lower bound, shown with one trailing "+".
 */
export function getNetPerHour({
  addedPerMinute,
  completedPerMinute,
}: {
  addedPerMinute: number;
  completedPerMinute: number;
}): { netPerHour: number; formatted: string } {
  const addedPerHour = Math.round(addedPerMinute * 60);
  const netPerHour = addedPerHour - Math.round(completedPerMinute * 60);
  if (addedPerHour >= MAX_QUEUE_COUNT) {
    return { netPerHour, formatted: `${intFormatter(netPerHour)}+` };
  }
  return {
    netPerHour,
    formatted:
      netPerHour > 0
        ? `+${intFormatter(netPerHour)}`
        : intFormatter(netPerHour),
  };
}

/**
 * What each queue stat measures, for the info tip beside its label. The
 * server-wide strip and the project aside share them so a stat reads the same
 * in both.
 */
export const QUEUE_STAT_HELP = {
  inQueue: `The number of evaluations that wait to start, are in progress, or wait to retry. This number is for all projects. The count stops at ${MAX_QUEUE_COUNT.toLocaleString("en-US")}.`,
  addedPerHour:
    "The number of evaluations added to the queue in the last hour.",
  completedPerHour:
    "The number of evaluations completed in the last hour. This number includes evaluations that failed.",
  netPerHour:
    "The number of evaluations added in the last hour, minus the number completed. If the number is more than 0, the queue gets longer. If the number is 0 or less, the queue does not get longer.",
  oldestWait:
    "The longest time that an evaluation in the queue has waited to start. This time does not include evaluations that wait to retry. If this time is more than 10 minutes, the queue is Degraded.",
  evaluationCost:
    "The model cost of the evaluations that ran in the selected time range. Phoenix gets this cost from the evaluator traces. If tracing is off for an evaluator, its cost is not included.",
} as const;

/** How long an evaluation may wait before its queue counts as Degraded. */
export const DEGRADED_WAIT_MS = 10 * 60_000;

export function hasWaitedTooLong(since: string): boolean {
  return Date.now() - new Date(since).getTime() > DEGRADED_WAIT_MS;
}

/**
 * How long the oldest waiting evaluation has waited, now: the wait that makes
 * a queue Degraded, in warning color past it.
 */
export function OldestWaitStat({
  oldestWaitingAt,
  help,
}: {
  oldestWaitingAt: string | null;
  /** What the stat means, behind an info icon beside its label. */
  help?: ReactNode;
}) {
  const isWaitingTooLong =
    oldestWaitingAt != null && hasWaitedTooLong(oldestWaitingAt);
  return (
    <StatItem label="Oldest wait" help={help}>
      <StatValue color={isWaitingTooLong ? "warning" : null}>
        {oldestWaitingAt != null ? formatElapsedShort(oldestWaitingAt) : "--"}
      </StatValue>
    </StatItem>
  );
}

/** A lag p95 above this shows as a warning. */
export const LAG_WARNING_SECONDS = 10 * 60;

export function isLagWarning(lagSeconds: number): boolean {
  return lagSeconds > LAG_WARNING_SECONDS;
}

/** The badge sits on the same line height as the mono values beside it. */
const badgeRowCSS = css`
  display: flex;
  align-items: center;
  min-height: var(--global-line-height-l);
`;

export function StatValue({
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

const statValueSkeletonCSS = css`
  display: flex;
  align-items: center;
  height: var(--global-line-height-l);
`;

/** A stat value while it loads, one line of value text tall. */
export function StatValueSkeleton() {
  return (
    <span
      css={statValueSkeletonCSS}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton width={40} height="var(--global-dimension-size-200)" />
    </span>
  );
}

export function HoverDetail({
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
