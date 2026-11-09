import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { startTransition, useEffect, useState } from "react";
import { Focusable } from "react-aria";

import {
  Flex,
  RichTooltip,
  Text,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import type { BadgeVariant } from "@phoenix/components/core/badge";
import { Badge } from "@phoenix/components/core/badge";
import {
  formatQueueCount,
  MAX_QUEUE_COUNT,
} from "@phoenix/pages/project/evaluators/evaluationQueueCounts";
import { formatElapsedShort } from "@phoenix/pages/project/evaluators/projectEvaluatorFormat";
import { StatItem } from "@phoenix/pages/project/TableAside";
import { assertUnreachable } from "@phoenix/typeUtils";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

/**
 * Pieces shared by the project evaluators aside and the server-wide project
 * evaluators strip, so both read the queue the same way.
 */

export type EvaluationQueueStatusValue = "HEALTHY" | "DEGRADED";

const QUEUE_STATS_POLL_INTERVAL_MS = 30_000;

/**
 * Polls the queue stats: a fetch key that changes on every poll or refresh.
 * Call it once per page, so the stats and charts refresh together.
 */
export function useQueueStatsPoll(refreshKey: string | number) {
  const [pollCount, setPollCount] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      // Keep the current stats up while the next poll loads.
      startTransition(() => setPollCount((count) => count + 1));
    }, QUEUE_STATS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);
  return { fetchKey: `${refreshKey}:${pollCount}` };
}

/** Each kind of evaluation's color in the queue meter and its legend. */
export const QUEUE_METER_COLOR_BY_TARGET = {
  SPAN: "category1",
  TRACE: "category2",
  SESSION: "category3",
} as const;

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
}: {
  oldestWaitingAt: string | null;
}) {
  const isWaitingTooLong =
    oldestWaitingAt != null && hasWaitedTooLong(oldestWaitingAt);
  return (
    <StatItem label="Oldest wait">
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
