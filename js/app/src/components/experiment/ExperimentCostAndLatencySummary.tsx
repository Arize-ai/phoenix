import { css } from "@emotion/react";

import {
  Flex,
  Icon,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { Skeleton } from "@phoenix/components/core/loading";
import type { ExecutionState } from "@phoenix/components/core/types";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import {
  costFormatter,
  numberFormatter,
  latencyMsFormatter,
} from "@phoenix/utils/numberFormatUtils";

import { ExperimentAverageRunTokenCosts } from "./ExperimentAverageRunTokenCosts";
import { ExperimentAverageRunTokenCount } from "./ExperimentAverageRunTokenCount";
import {
  computeMeanPerRun,
  computeOperationalMetricDelta,
} from "./experimentDeltaUtils";
import {
  ExperimentMetricDelta,
  ExperimentMetricStat,
  ExperimentMetricStatRow,
} from "./ExperimentMetricDelta";

/**
 * The shape of experiment data needed to render cost and latency summary.
 */
export type ExperimentCostAndLatencySummaryExperiment = {
  id: string;
  averageRunLatencyMs: number | null;
  runCount: number;
  costSummary: {
    total: {
      cost: number | null;
      tokens: number | null;
    };
  };
};

type ExperimentCostAndLatencySummaryProps = {
  /**
   * The current execution state
   * - idle: No experiment has been run yet (shows placeholder)
   * - running: Experiment is in progress (shows skeleton loaders)
   * - complete: Experiment finished (shows actual data)
   */
  executionState: ExecutionState;
  /**
   * Pre-fetched experiment data (required when executionState is "complete")
   */
  experiment?: ExperimentCostAndLatencySummaryExperiment | null;
  /**
   * Whether this is a placeholder in a non-experiment column (e.g., reference output).
   * When true, renders with reduced opacity.
   */
  isPlaceholder?: boolean;
  /**
   * The base experiment to show deltas against. Omitted on the base column
   * and when deltas are hidden.
   */
  baseExperiment?: ExperimentCostAndLatencySummaryExperiment;
};

/**
 * Per-run averages of an experiment's latency, tokens and cost.
 */
function getAverageRunMetrics(
  experiment: ExperimentCostAndLatencySummaryExperiment
) {
  const { runCount, costSummary, averageRunLatencyMs } = experiment;
  return {
    averageRunLatencyMs,
    averageRunTokenCountTotal: computeMeanPerRun({
      total: costSummary.total.tokens,
      runCount,
    }),
    averageRunCostTotal: computeMeanPerRun({
      total: costSummary.total.cost,
      runCount,
    }),
  };
}

const placeholderCSS = css`
  opacity: 0.5;
`;

/**
 * Component that displays aggregate experiment cost and latency summary.
 * Handles idle, running (loading), and complete states to prevent layout shifts.
 */
export function ExperimentCostAndLatencySummary({
  executionState,
  experiment,
  isPlaceholder = false,
  baseExperiment,
}: ExperimentCostAndLatencySummaryProps) {
  if (executionState === "idle") {
    return (
      <ExperimentCostAndLatencySummaryPlaceholder
        isPlaceholder={isPlaceholder}
      />
    );
  }

  if (executionState === "running") {
    return <ExperimentCostAndLatencySummarySkeleton />;
  }

  if (experiment == null) {
    return (
      <ExperimentCostAndLatencySummaryPlaceholder
        isPlaceholder={isPlaceholder}
      />
    );
  }

  const { id } = experiment;
  const {
    averageRunLatencyMs,
    averageRunTokenCountTotal,
    averageRunCostTotal,
  } = getAverageRunMetrics(experiment);
  const baseAverages = baseExperiment
    ? getAverageRunMetrics(baseExperiment)
    : null;

  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <TooltipTrigger>
        <TriggerWrap>
          <Text size="S" fontFamily="mono" color="gray-500">
            AVG
          </Text>
        </TriggerWrap>
        <Tooltip>Averages computed over all runs in the experiment</Tooltip>
      </TooltipTrigger>
      <ExperimentMetricStatRow>
        {averageRunLatencyMs != null && (
          <ExperimentMetricStat>
            <LatencyText size="S" latencyMs={averageRunLatencyMs} />
            {baseAverages && (
              <ExperimentMetricDelta
                delta={computeOperationalMetricDelta({
                  base: baseAverages.averageRunLatencyMs,
                  compare: averageRunLatencyMs,
                })}
                display="relative"
                metricLabel="Average latency"
                formatter={latencyMsFormatter}
                compareValueText={latencyMsFormatter(averageRunLatencyMs)}
                baseValueText={latencyMsFormatter(
                  baseAverages.averageRunLatencyMs
                )}
                tooltipPlacement="top"
              />
            )}
          </ExperimentMetricStat>
        )}
        <ExperimentMetricStat>
          <ExperimentAverageRunTokenCount
            averageRunTokenCountTotal={averageRunTokenCountTotal}
            experimentId={id}
            size="S"
          />
          {baseAverages && averageRunTokenCountTotal != null && (
            <ExperimentMetricDelta
              delta={computeOperationalMetricDelta({
                base: baseAverages.averageRunTokenCountTotal,
                compare: averageRunTokenCountTotal,
              })}
              display="relative"
              metricLabel="Average tokens per run"
              formatter={numberFormatter}
              compareValueText={numberFormatter(averageRunTokenCountTotal)}
              baseValueText={numberFormatter(
                baseAverages.averageRunTokenCountTotal
              )}
              tooltipPlacement="top"
            />
          )}
        </ExperimentMetricStat>
        {averageRunCostTotal != null && (
          <ExperimentMetricStat>
            <ExperimentAverageRunTokenCosts
              averageRunCostTotal={averageRunCostTotal}
              experimentId={id}
              size="S"
            />
            {baseAverages && (
              <ExperimentMetricDelta
                delta={computeOperationalMetricDelta({
                  base: baseAverages.averageRunCostTotal,
                  compare: averageRunCostTotal,
                })}
                display="relative"
                metricLabel="Average cost per run"
                formatter={costFormatter}
                compareValueText={costFormatter(averageRunCostTotal)}
                baseValueText={costFormatter(baseAverages.averageRunCostTotal)}
                tooltipPlacement="top"
              />
            )}
          </ExperimentMetricStat>
        )}
      </ExperimentMetricStatRow>
    </Flex>
  );
}

/**
 * Placeholder state shown when no experiment has been run.
 * Shows the icons with placeholder values (--).
 */
export function ExperimentCostAndLatencySummaryPlaceholder({
  isPlaceholder = false,
}: {
  isPlaceholder?: boolean;
}) {
  return (
    <Flex
      direction="row"
      gap="size-100"
      alignItems="center"
      css={isPlaceholder && placeholderCSS}
    >
      <Text size="S" fontFamily="mono" color="gray-500">
        AVG
      </Text>
      <LatencyText size="S" latencyMs={null} />
      <TokenCount size="S">{null}</TokenCount>
      <TokenCosts size="S">{null}</TokenCosts>
    </Flex>
  );
}

const skeletonItemCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--global-dimension-size-50);
  align-items: center;
  font-size: var(--global-font-size-s);
`;

/**
 * Skeleton loading state shown while experiment is running.
 * Shows the icons with skeleton loaders for the values.
 */
export function ExperimentCostAndLatencySummarySkeleton() {
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <Text size="S" fontFamily="mono" color="gray-500">
        AVG
      </Text>
      {/* Latency skeleton */}
      <div css={skeletonItemCSS}>
        <Text color="text-900" size="S">
          <Icon
            svg={<Icons.Clock />}
            css={css`
              font-size: 1.1em;
            `}
          />
        </Text>
        <Skeleton width={45} height="1em" />
      </div>
      {/* Token count skeleton */}
      <div css={skeletonItemCSS}>
        <Icon
          svg={<Icons.Tokens />}
          css={css`
            color: var(--global-text-color-900);
          `}
        />
        <Skeleton width={35} height="1em" />
      </div>
      {/* Cost skeleton */}
      <div css={skeletonItemCSS}>
        <Icon
          svg={<Icons.DollarSign />}
          css={css`
            color: var(--global-text-color-900);
          `}
        />
        <Skeleton width={45} height="1em" />
      </div>
    </Flex>
  );
}
