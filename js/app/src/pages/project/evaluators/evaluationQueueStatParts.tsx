import { css } from "@emotion/react";
import type { ReactNode } from "react";
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
import { assertUnreachable } from "@phoenix/typeUtils";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

/**
 * Pieces shared by the project evaluators aside and the server-wide project
 * evaluators strip, so both read the queue the same way.
 */

export type EvaluationQueueStatusValue = "HEALTHY" | "DEGRADED";

const QUEUE_LABEL_BY_TARGET: Record<string, string> = {
  SPAN: "Spans",
  TRACE: "Traces",
  SESSION: "Sessions",
};

export function getQueueLabel(target: { evaluationTarget: string }): string {
  return (
    QUEUE_LABEL_BY_TARGET[target.evaluationTarget] ?? target.evaluationTarget
  );
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
  atCapacity: boolean;
}): string | null {
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

/** A per-minute rate as a whole number per hour. */
export function formatPerHour(perMinute: number): string {
  return intFormatter(Math.round(perMinute * 60));
}

/** How long an evaluation may wait before its queue counts as Degraded. */
export const DEGRADED_WAIT_MS = 10 * 60_000;

export function hasWaitedTooLong(since: string): boolean {
  return Date.now() - new Date(since).getTime() > DEGRADED_WAIT_MS;
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
