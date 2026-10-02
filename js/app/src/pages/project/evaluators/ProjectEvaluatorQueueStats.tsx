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

const QUEUE_LABEL_BY_TARGET: Record<string, string> = {
  SPAN: "Span Queue",
  TRACE: "Trace Queue",
  SESSION: "Session Queue",
};

const QUEUE_STATUS_BADGE: Record<
  EvaluationQueueStatus,
  { label: string; variant: BadgeVariant }
> = {
  HEALTHY: { label: "Healthy", variant: "success" },
  DEGRADED: { label: "Degraded", variant: "warning" },
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
        : "Next evaluation has waited more than 10 minutes";
    default:
      return assertUnreachable(queue.status);
  }
}

/** Fills the meter in the warning color once the queue is full. */
const fullMeterCSS = css`
  --mod-barloader-fill-color: var(--global-color-warning);
`;

const wholeRateFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});
const smallRateFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

/** Whole numbers once a rate reaches 10 a minute, so in and out read alike. */
function formatRate(perMinute: number): string {
  return (perMinute >= 10 ? wholeRateFormatter : smallRateFormatter).format(
    perMinute
  );
}

/**
 * The health of each evaluation queue this project's enabled evaluators use,
 * as a row of stats above the evaluators table. Renders nothing when no
 * enabled evaluator uses a queue.
 */
export function ProjectEvaluatorQueueStats({
  projectId,
  refreshKey,
}: {
  projectId: string;
  /** Changes when the queue was changed from this page, to refetch at once. */
  refreshKey: number;
}) {
  return (
    <ErrorBoundary fallback={() => null}>
      <Suspense fallback={null}>
        <ProjectEvaluatorQueueStatsContent
          projectId={projectId}
          refreshKey={refreshKey}
        />
      </Suspense>
    </ErrorBoundary>
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
                  evaluationTarget
                  enabled
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
  const evaluators = (data.project?.evaluators?.edges ?? []).map(
    ({ node }) => node
  );
  const usedTargets = new Set(
    evaluators
      .filter((evaluator) => evaluator.enabled)
      .map((evaluator) => evaluator.evaluationTarget)
  );
  const queues = data.evaluationQueues.filter((queue) =>
    usedTargets.has(queue.evaluationTarget)
  );
  if (queues.length === 0) {
    return null;
  }
  const projectQueuedByTarget = new Map<string, number>();
  for (const evaluator of evaluators) {
    projectQueuedByTarget.set(
      evaluator.evaluationTarget,
      (projectQueuedByTarget.get(evaluator.evaluationTarget) ?? 0) +
        evaluator.runSummary.queuedCount
    );
  }
  return (
    <View
      paddingX="size-200"
      paddingY="size-100"
      borderBottomWidth="thin"
      borderBottomColor="default"
      flex="none"
    >
      <Flex direction="column" gap="size-100">
        {queues.map((queue) => (
          <QueueStatsRow
            key={queue.evaluationTarget}
            queue={queue}
            queuedLabel={
              queues.length > 1
                ? (QUEUE_LABEL_BY_TARGET[queue.evaluationTarget] ?? "Queued")
                : "Queued"
            }
            projectQueuedCount={
              projectQueuedByTarget.get(queue.evaluationTarget) ?? 0
            }
          />
        ))}
      </Flex>
    </View>
  );
}

function QueueStatsRow({
  queue,
  queuedLabel,
  projectQueuedCount,
}: {
  queue: EvaluationQueue;
  queuedLabel: string;
  projectQueuedCount: number;
}) {
  const statusBadge = QUEUE_STATUS_BADGE[queue.status];
  const statusDetail = getQueueStatusDetail(queue);
  return (
    <Flex direction="row" gap="size-400" alignItems="start">
      <Stat
        label="Status"
        detail={statusDetail ? <Text size="S">{statusDetail}</Text> : null}
      >
        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
      </Stat>
      <Stat
        label={queuedLabel}
        detail={
          <>
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
          <Text
            size="L"
            fontFamily="mono"
            color={queue.atCapacity ? "warning" : undefined}
          >
            {intFormatter(queue.queuedCount)}
          </Text>
          <span css={queue.atCapacity ? fullMeterCSS : undefined}>
            <ProgressBar
              width="80px"
              value={Math.min(queue.queuedCount, queue.queuedLimit)}
              maxValue={queue.queuedLimit}
              aria-label="How full the queue is"
            />
          </span>
        </Flex>
      </Stat>
      <Stat
        label="In / Out"
        detail={<Text size="S">Average over the last 15 minutes</Text>}
      >
        <Flex direction="row" gap="size-50" alignItems="baseline">
          <Text size="L" fontFamily="mono">
            {`${formatRate(queue.queuedPerMinute)} / ${formatRate(queue.evaluationsPerMinute)}`}
          </Text>
          <Text size="S" color="text-700">
            /min
          </Text>
        </Flex>
      </Stat>
      <Stat
        label="Waiting"
        detail={<Text size="S">Time the next evaluation has waited</Text>}
      >
        <Text
          size="L"
          fontFamily="mono"
          color={
            queue.status === "DEGRADED" && !queue.atCapacity
              ? "warning"
              : undefined
          }
        >
          {queue.oldestQueuedAt != null
            ? formatElapsedShort(queue.oldestQueuedAt)
            : "--"}
        </Text>
      </Stat>
    </Flex>
  );
}

function Stat({
  label,
  detail,
  children,
}: {
  label: string;
  /** Shown on hover; null for a value that needs no explanation. */
  detail: ReactNode;
  children: ReactNode;
}) {
  return (
    <Flex direction="column" flex="none">
      <Text elementType="h3" size="S" color="text-700">
        {label}
      </Text>
      {detail == null ? (
        children
      ) : (
        <TooltipTrigger delay={0}>
          <Focusable>
            <span role="button">{children}</span>
          </Focusable>
          <RichTooltip placement="bottom">
            <TooltipArrow />
            <Flex direction="column" gap="size-50">
              {detail}
            </Flex>
          </RichTooltip>
        </TooltipTrigger>
      )}
    </Flex>
  );
}
