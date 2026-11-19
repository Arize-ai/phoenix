import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { Alert, Flex, Text, View } from "@phoenix/components";
import { Skeleton } from "@phoenix/components/core/loading";
import { ErrorBoundary } from "@phoenix/components/exception";
import {
  DEGRADED_WAIT_MS,
  QueueStatusBadge,
} from "@phoenix/pages/project/evaluators/evaluationQueueStatParts";

const DEGRADED_WAIT_MINUTES = DEGRADED_WAIT_MS / 60_000;

const statusLegendCSS = css`
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  column-gap: var(--global-dimension-size-100);
  row-gap: var(--global-dimension-size-50);
  white-space: nowrap;
`;

/** What each queue status means, beside its badge. */
export const QUEUE_STATUS_LEGEND = (
  <div css={statusLegendCSS}>
    <QueueStatusBadge status="HEALTHY" />
    <Text size="S">{`Evaluations start within ${DEGRADED_WAIT_MINUTES} min`}</Text>
    <QueueStatusBadge status="DEGRADED" />
    <Text size="S">{`Some have waited over ${DEGRADED_WAIT_MINUTES} min`}</Text>
  </div>
);

const statsRowCSS = css`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  column-gap: var(--global-dimension-size-400);
  row-gap: var(--global-dimension-size-150);
`;

/** The queue stats, in one row that wraps on narrow screens. */
export function EvaluationQueueStatsRow({ children }: { children: ReactNode }) {
  return <div css={statsRowCSS}>{children}</div>;
}

/**
 * The queue strip at the top of an evaluators view: the queue stats on the
 * left and the queue actions menu on the right. The actions stay outside the
 * stats' error boundary, so a failed poll can't take the clear control with
 * it.
 */
export function EvaluationQueueStrip({
  fetchKey,
  actions,
  children,
}: {
  /** From the page's queue stats poll; a new key retries a failed load. */
  fetchKey: string;
  actions: ReactNode;
  /** The stats, which may suspend while they load. */
  children: ReactNode;
}) {
  return (
    <View
      paddingX="size-200"
      paddingY="size-150"
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
        <ErrorBoundary
          resetKey={fetchKey}
          fallback={() => (
            <Flex direction="column" gap="size-100">
              <EvaluationQueueStatsPlaceholder />
              <Alert variant="danger">Couldn't load the queue stats</Alert>
            </Flex>
          )}
        >
          <Suspense fallback={<EvaluationQueueStatsPlaceholder />}>
            {children}
          </Suspense>
        </ErrorBoundary>
        {actions}
      </Flex>
    </View>
  );
}

const statSkeletonCSS = css`
  display: flex;
  flex-direction: column;
  flex: none;
  .stat-skeleton__label,
  .stat-skeleton__value {
    display: flex;
    align-items: center;
  }
  /* A loaded label is one line of small text, a value one of large text */
  .stat-skeleton__label {
    height: var(--global-line-height-s);
  }
  .stat-skeleton__value {
    height: var(--global-line-height-l);
  }
`;

/**
 * A stat while it loads: a bar where its label goes over one where its value
 * goes. Labels are the width their text and info icon take, so each stat
 * keeps its loaded width and place.
 */
function StatSkeleton({
  labelWidth,
  valueWidth,
}: {
  labelWidth: number;
  valueWidth: number | string;
}) {
  return (
    <div css={statSkeletonCSS}>
      <span className="stat-skeleton__label">
        <Skeleton
          width={labelWidth}
          height="var(--global-dimension-size-150)"
        />
      </span>
      <span className="stat-skeleton__value">
        <Skeleton
          width={valueWidth}
          height="var(--global-dimension-size-200)"
        />
      </span>
    </div>
  );
}

/**
 * The stats' shape while they load, laid out as the loaded stats are, with
 * the label widths of the loaded text so nothing shifts when they arrive.
 * Both strips show the same seven stats under the same labels.
 */
function EvaluationQueueStatsPlaceholder() {
  return (
    <div css={statsRowCSS} aria-hidden>
      <StatSkeleton
        labelWidth={64}
        valueWidth="var(--global-dimension-size-650)"
      />
      <StatSkeleton
        labelWidth={80}
        valueWidth="var(--global-dimension-size-600)"
      />
      <StatSkeleton labelWidth={123} valueWidth={40} />
      <StatSkeleton labelWidth={152} valueWidth={40} />
      <StatSkeleton labelWidth={105} valueWidth={24} />
      <StatSkeleton labelWidth={97} valueWidth={24} />
      <StatSkeleton labelWidth={121} valueWidth={24} />
    </div>
  );
}

/**
 * The whole strip while the page loads, before its queue actions menu can
 * be shown, laid out as the loaded strip is. The strip's divider is left
 * undrawn, but its space is kept.
 */
export function EvaluationQueueStripSkeleton() {
  return (
    <div css={stripSkeletonCSS}>
      <EvaluationQueueStatsPlaceholder />
      <Skeleton
        width="var(--global-button-height-s)"
        height="var(--global-button-height-s)"
      />
    </div>
  );
}

const stripSkeletonCSS = css`
  flex: none;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-150) var(--global-dimension-size-200);
  padding-bottom: calc(
    var(--global-dimension-size-150) + var(--global-border-size-thin)
  );
`;
