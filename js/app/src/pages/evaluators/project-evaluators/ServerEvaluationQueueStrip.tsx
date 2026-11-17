import { css } from "@emotion/react";
import { Suspense, useEffect, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Alert, Flex, Text, View } from "@phoenix/components";
import { Skeleton } from "@phoenix/components/core/loading";
import { ErrorBoundary } from "@phoenix/components/exception/ErrorBoundary";
import type { ServerEvaluationQueueStripQuery } from "@phoenix/pages/evaluators/project-evaluators/__generated__/ServerEvaluationQueueStripQuery.graphql";
import { useServerEvaluationActivity } from "@phoenix/pages/evaluators/project-evaluators/ServerEvaluationCharts";
import { ClearAllQueuedEvaluationsMenu } from "@phoenix/pages/project/evaluators/ClearQueuedEvaluationsButton";
import {
  formatQueueCount,
  getClearableCount,
} from "@phoenix/pages/project/evaluators/evaluationQueueCounts";
import {
  DEGRADED_WAIT_MS,
  formatAddedPerHour,
  formatCompletedPerHour,
  getNetPerHour,
  getQueueStatusDetail,
  HoverDetail,
  OldestWaitStat,
  QueueStatusBadge,
  StatValue,
} from "@phoenix/pages/project/evaluators/evaluationQueueStatParts";
import { formatEvaluationTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorFormat";
import { StatItem } from "@phoenix/pages/project/TableAside";
import { costFormatter } from "@phoenix/utils/numberFormatUtils";

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
const STATUS_LEGEND = (
  <div css={statusLegendCSS}>
    <QueueStatusBadge status="HEALTHY" />
    <Text size="S">{`Evaluations start within ${DEGRADED_WAIT_MINUTES} min`}</Text>
    <QueueStatusBadge status="DEGRADED" />
    <Text size="S">{`Some have waited over ${DEGRADED_WAIT_MINUTES} min`}</Text>
  </div>
);

const stripCSS = css`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  column-gap: var(--global-dimension-size-400);
  row-gap: var(--global-dimension-size-150);
`;

/**
 * The server-wide queue strip: the one queue every project's evaluators share,
 * how fast it fills and drains, how stale results are, and what evaluations
 * cost over the selected range. Clearing every project's queue lives here and
 * nowhere else.
 */
export function ServerEvaluationQueueStrip({
  fetchKey,
  onQueueCleared,
}: {
  /** From the page's queue stats poll. */
  fetchKey: string;
  onQueueCleared: () => void;
}) {
  // Read by the queue actions menu, which stays outside the stats' error boundary
  // so a failed poll can't take the only clear-all control with it.
  const [clearableCount, setClearableCount] = useState<number | null>(null);
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
              <StripPlaceholder />
              <Alert variant="danger">Couldn't load the queue stats</Alert>
            </Flex>
          )}
        >
          <Suspense fallback={<StripPlaceholder />}>
            <ServerEvaluationQueueStripContent
              fetchKey={fetchKey}
              onClearableCount={setClearableCount}
            />
          </Suspense>
        </ErrorBoundary>
        <ClearAllQueuedEvaluationsMenu
          isQueueEmpty={clearableCount === 0}
          onCleared={onQueueCleared}
        />
      </Flex>
    </View>
  );
}

function ServerEvaluationQueueStripContent({
  fetchKey,
  onClearableCount,
}: {
  fetchKey: string;
  onClearableCount: (clearableCount: number) => void;
}) {
  const data = useLazyLoadQuery<ServerEvaluationQueueStripQuery>(
    graphql`
      query ServerEvaluationQueueStripQuery {
        evaluationQueue {
          status
          queuedCount
          runningCount
          oldestWaitingAt
          addedPerMinute
          completedPerMinute
          targets {
            evaluationTarget
            queuedCount
          }
          projects(first: 5) {
            project {
              id
              name
            }
            queuedCount
          }
        }
      }
    `,
    {},
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  const queue = data.evaluationQueue;
  const queuedTargets = queue.targets.filter(
    (target) => target.queuedCount > 0
  );
  const statusDetail = getQueueStatusDetail(queue);
  const net = getNetPerHour(queue);
  const clearableCount = getClearableCount(queue);
  useEffect(() => {
    onClearableCount(clearableCount);
  }, [clearableCount, onClearableCount]);
  return (
    <>
      <div css={stripCSS}>
        <StatItem label="Status" help={STATUS_LEGEND}>
          <HoverDetail
            detail={
              statusDetail != null ? <Text size="S">{statusDetail}</Text> : null
            }
          >
            <QueueStatusBadge status={queue.status} />
          </HoverDetail>
        </StatItem>
        <StatItem
          label="In queue"
          help="Evaluations waiting, running, or retrying, across all projects."
        >
          <HoverDetail
            detail={
              queuedTargets.length > 0 || queue.projects.length > 0 ? (
                <Flex direction="column" gap="size-100">
                  {queuedTargets.length > 0 ? (
                    <Flex direction="column" gap="size-25">
                      <Text size="S" color="text-700">
                        By kind
                      </Text>
                      {queuedTargets.map((target) => (
                        <Text key={target.evaluationTarget} size="S">
                          {`${formatEvaluationTarget(target.evaluationTarget)}: ${formatQueueCount(target.queuedCount)}`}
                        </Text>
                      ))}
                    </Flex>
                  ) : null}
                  {queue.projects.length > 0 ? (
                    <Flex direction="column" gap="size-25">
                      <Text size="S" color="text-700">
                        Most queued
                      </Text>
                      {queue.projects.map(({ project, queuedCount }) => (
                        <Text key={project.id} size="S">
                          {`${project.name}: ${formatQueueCount(queuedCount)}`}
                        </Text>
                      ))}
                    </Flex>
                  ) : null}
                </Flex>
              ) : null
            }
          >
            <StatValue>{formatQueueCount(queue.queuedCount)}</StatValue>
          </HoverDetail>
        </StatItem>
        <StatItem
          label="Added per hour"
          help="Evaluations queued in the last hour."
        >
          <StatValue>{formatAddedPerHour(queue.addedPerMinute)}</StatValue>
        </StatItem>
        <StatItem
          label="Completed per hour"
          help="Evaluations finished in the last hour, including failures."
        >
          <StatValue>
            {formatCompletedPerHour(queue.completedPerMinute)}
          </StatValue>
        </StatItem>
        <StatItem
          label="Net per hour"
          help="Added minus completed. Positive means the queue is growing."
        >
          <StatValue color={net.netPerHour > 0 ? "warning" : null}>
            {net.formatted}
          </StatValue>
        </StatItem>
        <OldestWaitStat
          oldestWaitingAt={queue.oldestWaitingAt}
          help="How long the oldest queued evaluation has waited to start."
        />
        <StatItem
          label="Evaluation cost"
          help="Cost of evaluations in the selected time range."
        >
          <Suspense fallback={<StatValue>--</StatValue>}>
            <EvaluationCostValue fetchKey={fetchKey} />
          </Suspense>
        </StatItem>
      </div>
    </>
  );
}

/** The selected range's cost, from the charts' activity request. */
function EvaluationCostValue({ fetchKey }: { fetchKey: string }) {
  const { data } = useServerEvaluationActivity({
    fetchKey,
    fetchPolicy: "store-or-network",
  });
  const activity = data.evaluationActivity;
  return (
    <HoverDetail
      detail={
        activity.excludesUntracedEvaluators ? (
          <Text size="S">Excludes evaluators with tracing off</Text>
        ) : null
      }
    >
      <StatValue>
        {activity.cost != null ? costFormatter(activity.cost) : "--"}
      </StatValue>
    </HoverDetail>
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
 * The strip's shape while it loads, laid out as the loaded stats are, with
 * the label widths of the loaded text so nothing shifts when it arrives.
 */
function StripPlaceholder() {
  return (
    <div css={stripCSS} aria-hidden>
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
export function ServerEvaluationQueueStripSkeleton() {
  return (
    <div css={stripSkeletonCSS}>
      <StripPlaceholder />
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
