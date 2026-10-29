import { css } from "@emotion/react";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Button, Flex, Text, View } from "@phoenix/components";
import { useCategoryChartColors } from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/components/datetime";
import { ErrorBoundary } from "@phoenix/components/exception/ErrorBoundary";
import type { ServerEvaluationQueueStripQuery } from "@phoenix/pages/evaluators/projectEvaluators/__generated__/ServerEvaluationQueueStripQuery.graphql";
import { ClearAllQueuedEvaluationsButton } from "@phoenix/pages/project/evaluators/ClearQueuedEvaluationsButton";
import { EvaluationQueueMeter } from "@phoenix/pages/project/evaluators/EvaluationQueueMeter";
import {
  DEGRADED_WAIT_MS,
  formatPerHour,
  getQueueLabel,
  getQueueStatusDetail,
  hasWaitedTooLong,
  HoverDetail,
  QUEUE_METER_COLOR_BY_TARGET,
  QueueStatusBadge,
  StatValue,
  useQueueStatsPoll,
} from "@phoenix/pages/project/evaluators/evaluationQueueStatParts";
import {
  formatElapsedShort,
  formatLag,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { StatItem } from "@phoenix/pages/project/TableAside";
import { costFormatter, intFormatter } from "@phoenix/utils/numberFormatUtils";

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
  refreshKey,
  onQueueCleared,
  onShowQueueDrivers,
}: {
  /** Changes when the queue was changed from this page, to refetch at once. */
  refreshKey: number;
  onQueueCleared: () => void;
  /** Brings the evaluators holding most of the queue to the top of the table. */
  onShowQueueDrivers: () => void;
}) {
  const { fetchKey, lastHour } = useQueueStatsPoll(refreshKey);
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
        <ErrorBoundary fallback={() => <StripPlaceholder />}>
          <Suspense fallback={<StripPlaceholder />}>
            <ServerEvaluationQueueStripContent
              fetchKey={fetchKey}
              lastHour={lastHour}
              onQueueCleared={onQueueCleared}
              onShowQueueDrivers={onShowQueueDrivers}
            />
          </Suspense>
        </ErrorBoundary>
      </Flex>
    </View>
  );
}

function ServerEvaluationQueueStripContent({
  fetchKey,
  lastHour,
  onQueueCleared,
  onShowQueueDrivers,
}: {
  fetchKey: string;
  lastHour: { start: string; end: string };
  onQueueCleared: () => void;
  onShowQueueDrivers: () => void;
}) {
  const { timeRangeISOStrings } = useTimeRange();
  const data = useLazyLoadQuery<ServerEvaluationQueueStripQuery>(
    graphql`
      query ServerEvaluationQueueStripQuery(
        $lastHour: TimeRange!
        $timeRange: TimeRange!
      ) {
        evaluationQueue {
          status
          atCapacity
          queuedCount
          queuedLimit
          runningCount
          oldestQueuedAt
          queuedPerMinute
          evaluationsPerMinute
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
        lastHourActivity: evaluationActivity(timeRange: $lastHour) {
          lag {
            p50Seconds
            p95Seconds
            p99Seconds
          }
        }
        rangeActivity: evaluationActivity(timeRange: $timeRange) {
          evaluatedCount
          failedCount
          cost
        }
      }
    `,
    { lastHour, timeRange: timeRangeISOStrings },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  const queue = data.evaluationQueue;
  const colors = useCategoryChartColors();
  const segments = queue.targets.map((target) => ({
    id: target.evaluationTarget,
    label: getQueueLabel(target),
    count: target.queuedCount,
    color:
      colors[
        QUEUE_METER_COLOR_BY_TARGET[
          target.evaluationTarget as keyof typeof QUEUE_METER_COLOR_BY_TARGET
        ] ?? "category4"
      ],
  }));
  const statusDetail = getQueueStatusDetail(queue);
  const netPerMinute = queue.queuedPerMinute - queue.evaluationsPerMinute;
  const netPerHour = Math.round(netPerMinute * 60);
  const lag = data.lastHourActivity.lag;
  const isWaitingTooLong =
    queue.oldestQueuedAt != null && hasWaitedTooLong(queue.oldestQueuedAt);
  const isLagging = lag != null && lag.p95Seconds * 1000 > DEGRADED_WAIT_MS;
  const clearableCount = queue.queuedCount - queue.runningCount;
  return (
    <>
      <div css={stripCSS}>
        <StatItem label="Status">
          <HoverDetail
            detail={
              statusDetail != null ? <Text size="S">{statusDetail}</Text> : null
            }
          >
            <QueueStatusBadge status={queue.status} />
          </HoverDetail>
          {queue.status === "DEGRADED" ? (
            <Button size="S" variant="quiet" onPress={onShowQueueDrivers}>
              What's driving it
            </Button>
          ) : null}
        </StatItem>
        <StatItem label="In queue">
          <Flex direction="column" gap="size-50" minWidth="size-2400">
            <Flex direction="row" gap="size-75" alignItems="baseline">
              <HoverDetail
                detail={
                  queue.projects.length > 0 ? (
                    <>
                      <Text size="S" color="text-700">
                        Most queued
                      </Text>
                      {queue.projects.map(({ project, queuedCount }) => (
                        <Text key={project.id} size="S">
                          {`${project.name}: ${intFormatter(queuedCount)}`}
                        </Text>
                      ))}
                    </>
                  ) : null
                }
              >
                <StatValue>{intFormatter(queue.queuedCount)}</StatValue>
              </HoverDetail>
              <Text size="S" color={queue.atCapacity ? "warning" : "text-700"}>
                {`/ ${intFormatter(queue.queuedLimit)}`}
              </Text>
            </Flex>
            <EvaluationQueueMeter
              segments={segments}
              limit={queue.queuedLimit}
            />
          </Flex>
        </StatItem>
        <StatItem label="Queued / hr">
          <StatValue>{formatPerHour(queue.queuedPerMinute)}</StatValue>
        </StatItem>
        <StatItem label="Completed / hr">
          <StatValue>{formatPerHour(queue.evaluationsPerMinute)}</StatValue>
        </StatItem>
        <StatItem label="Net / hr">
          <HoverDetail
            detail={
              <Text size="S" color="text-700">
                Queued minus completed, last hour
              </Text>
            }
          >
            <StatValue color={netPerHour > 0 ? "warning" : null}>
              {netPerHour > 0
                ? `+${intFormatter(netPerHour)}`
                : intFormatter(netPerHour)}
            </StatValue>
          </HoverDetail>
        </StatItem>
        <StatItem label="Lag p95">
          <HoverDetail
            detail={
              <>
                <Text size="S" color="text-700">
                  Queued to result, last hour
                </Text>
                {lag != null ? (
                  <Text size="S">{`p50 ${formatLag(lag.p50Seconds)} · p99 ${formatLag(lag.p99Seconds)}`}</Text>
                ) : null}
                <Text size="S" color={isWaitingTooLong ? "warning" : undefined}>
                  {`Longest wait: ${queue.oldestQueuedAt != null ? formatElapsedShort(queue.oldestQueuedAt) : "none"}`}
                </Text>
              </>
            }
          >
            <StatValue color={isLagging || isWaitingTooLong ? "warning" : null}>
              {lag != null ? formatLag(lag.p95Seconds) : "--"}
            </StatValue>
          </HoverDetail>
        </StatItem>
        <StatItem label="Evaluation cost">
          <HoverDetail
            detail={
              <Text size="S">{`${intFormatter(data.rangeActivity.evaluatedCount)} evaluated · ${intFormatter(data.rangeActivity.failedCount)} failed`}</Text>
            }
          >
            <StatValue>
              {data.rangeActivity.cost != null
                ? costFormatter(data.rangeActivity.cost)
                : "--"}
            </StatValue>
          </HoverDetail>
        </StatItem>
      </div>
      <ClearAllQueuedEvaluationsButton
        isQueueEmpty={clearableCount <= 0}
        onCleared={onQueueCleared}
      />
    </>
  );
}

/** The strip's shape while it loads, so the page doesn't shift. */
function StripPlaceholder() {
  return (
    <div css={stripCSS}>
      {[
        "Status",
        "In queue",
        "Queued / hr",
        "Completed / hr",
        "Net / hr",
        "Lag p95",
        "Evaluation cost",
      ].map((label) => (
        <StatItem key={label} label={label}>
          <StatValue>--</StatValue>
        </StatItem>
      ))}
    </div>
  );
}
