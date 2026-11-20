import { Suspense, useEffect, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, Text } from "@phoenix/components";
import { useTimeRange } from "@phoenix/components/datetime";
import {
  ErrorBoundary,
  TextErrorBoundaryFallback,
} from "@phoenix/components/exception";
import type { ServerEvaluationQueueStripQuery } from "@phoenix/pages/evaluators/project-evaluators/__generated__/ServerEvaluationQueueStripQuery.graphql";
import { useServerEvaluationActivity } from "@phoenix/pages/evaluators/project-evaluators/ServerEvaluationCharts";
import { ClearQueuedEvaluationsMenu } from "@phoenix/pages/project/evaluators/ClearQueuedEvaluationsMenu";
import {
  formatQueueCount,
  getClearableCount,
} from "@phoenix/pages/project/evaluators/evaluationQueueCounts";
import {
  formatAddedPerHour,
  formatCompletedPerHour,
  getNetPerHour,
  getQueueStatusDetail,
  HoverDetail,
  OldestWaitStat,
  QUEUE_STAT_HELP,
  QueueStatusBadge,
  StatValue,
} from "@phoenix/pages/project/evaluators/evaluationQueueStatParts";
import {
  EvaluationQueueStatsRow,
  EvaluationQueueStrip,
  QUEUE_STATUS_LEGEND,
} from "@phoenix/pages/project/evaluators/EvaluationQueueStrip";
import { formatEvaluationTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorFormat";
import { StatItem } from "@phoenix/pages/project/TableAside";
import { costFormatter } from "@phoenix/utils/numberFormatUtils";

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
  const [clearableCount, setClearableCount] = useState<number | null>(null);
  return (
    <EvaluationQueueStrip
      fetchKey={fetchKey}
      actions={
        <ClearQueuedEvaluationsMenu
          scope={{ type: "ALL" }}
          isQueueEmpty={clearableCount === 0}
          onCleared={onQueueCleared}
        />
      }
    >
      <ServerEvaluationQueueStripContent
        fetchKey={fetchKey}
        onClearableCount={setClearableCount}
      />
    </EvaluationQueueStrip>
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
  const { timeRangeISOStrings } = useTimeRange();
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
    <EvaluationQueueStatsRow>
      <StatItem label="Status" help={QUEUE_STATUS_LEGEND}>
        <HoverDetail
          detail={
            statusDetail != null ? <Text size="S">{statusDetail}</Text> : null
          }
        >
          <QueueStatusBadge status={queue.status} />
        </HoverDetail>
      </StatItem>
      <StatItem label="In queue" help={QUEUE_STAT_HELP.inQueue}>
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
      <StatItem label="Added per hour" help={QUEUE_STAT_HELP.addedPerHour}>
        <StatValue>{formatAddedPerHour(queue.addedPerMinute)}</StatValue>
      </StatItem>
      <StatItem
        label="Completed per hour"
        help={QUEUE_STAT_HELP.completedPerHour}
      >
        <StatValue>
          {formatCompletedPerHour(queue.completedPerMinute)}
        </StatValue>
      </StatItem>
      <StatItem label="Net per hour" help={QUEUE_STAT_HELP.netPerHour}>
        <StatValue color={net.netPerHour > 0 ? "warning" : null}>
          {net.formatted}
        </StatValue>
      </StatItem>
      <OldestWaitStat
        oldestWaitingAt={queue.oldestWaitingAt}
        help={QUEUE_STAT_HELP.oldestWait}
      />
      <StatItem label="Evaluation cost" help={QUEUE_STAT_HELP.evaluationCost}>
        {/* Cost reads the heavier activity request; its errors stay here. */}
        <ErrorBoundary
          resetKey={`${fetchKey} ${timeRangeISOStrings.start} ${timeRangeISOStrings.end}`}
          fallback={TextErrorBoundaryFallback}
        >
          <Suspense fallback={<StatValue>--</StatValue>}>
            <EvaluationCostValue fetchKey={fetchKey} />
          </Suspense>
        </ErrorBoundary>
      </StatItem>
    </EvaluationQueueStatsRow>
  );
}

/**
 * The selected range's cost. It shares the charts' activity request when they
 * are shown, and fetches it on its own when they are not.
 */
function EvaluationCostValue({ fetchKey }: { fetchKey: string }) {
  const { data } = useServerEvaluationActivity({ fetchKey });
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
