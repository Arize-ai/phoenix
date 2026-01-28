import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
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
import { Skeleton } from "@phoenix/components/loading";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { ExecutionState } from "@phoenix/components/types";

import type { ExperimentCostAndLatencySummaryQuery } from "./__generated__/ExperimentCostAndLatencySummaryQuery.graphql";
import { ExperimentAverageRunTokenCosts } from "./ExperimentAverageRunTokenCosts";
import { ExperimentAverageRunTokenCount } from "./ExperimentAverageRunTokenCount";

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
};

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

  const { id, runCount, costSummary, averageRunLatencyMs } = experiment;
  const costTotal = costSummary.total.cost;
  const tokenCountTotal = costSummary.total.tokens;

  const averageRunTokenCountTotal =
    tokenCountTotal == null || runCount === 0
      ? null
      : tokenCountTotal / runCount;

  const averageRunCostTotal =
    costTotal == null || runCount === 0 ? null : costTotal / runCount;

  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <TooltipTrigger>
        <TriggerWrap>
          <Text size="S" fontFamily="mono" color="grey-500">
            AVG
          </Text>
        </TriggerWrap>
        <Tooltip>Averages computed over all runs in the experiment</Tooltip>
      </TooltipTrigger>
      {averageRunLatencyMs != null && (
        <LatencyText size="S" latencyMs={averageRunLatencyMs} />
      )}
      <ExperimentAverageRunTokenCount
        averageRunTokenCountTotal={averageRunTokenCountTotal}
        experimentId={id}
        size="S"
      />
      {averageRunCostTotal != null && (
        <ExperimentAverageRunTokenCosts
          averageRunCostTotal={averageRunCostTotal}
          experimentId={id}
          size="S"
        />
      )}
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
      <Text size="S" fontFamily="mono" color="grey-500">
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
  gap: var(--ac-global-dimension-static-size-50);
  align-items: center;
  font-size: var(--ac-global-font-size-s);
`;

/**
 * Skeleton loading state shown while experiment is running.
 * Shows the icons with skeleton loaders for the values.
 */
export function ExperimentCostAndLatencySummarySkeleton() {
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <Text size="S" fontFamily="mono" color="grey-500">
        AVG
      </Text>
      {/* Latency skeleton */}
      <div css={skeletonItemCSS}>
        <Text color="text-900" size="S">
          <Icon
            svg={<Icons.ClockOutline />}
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
          svg={<Icons.TokensOutline />}
          css={css`
            color: var(--ac-global-text-color-900);
          `}
        />
        <Skeleton width={35} height="1em" />
      </div>
      {/* Cost skeleton */}
      <div css={skeletonItemCSS}>
        <Icon
          svg={<Icons.DollarSignOutline />}
          css={css`
            color: var(--ac-global-text-color-900);
          `}
        />
        <Skeleton width={45} height="1em" />
      </div>
    </Flex>
  );
}

type ConnectedExperimentCostAndLatencySummaryProps = {
  /**
   * The id of the experiment to fetch and display summary for
   */
  experimentId: string;
};

/**
 * Connected component that fetches experiment data via GraphQL and renders ExperimentCostAndLatencySummary.
 * Use the pure ExperimentCostAndLatencySummary component directly if you already have the experiment data.
 */
export function ConnectedExperimentCostAndLatencySummary({
  experimentId,
}: ConnectedExperimentCostAndLatencySummaryProps) {
  const data = useLazyLoadQuery<ExperimentCostAndLatencySummaryQuery>(
    graphql`
      query ExperimentCostAndLatencySummaryQuery($experimentId: ID!) {
        experiment: node(id: $experimentId) {
          __typename
          ... on Experiment {
            id
            averageRunLatencyMs
            runCount
            costSummary {
              total {
                cost
                tokens
              }
            }
          }
        }
      }
    `,
    { experimentId },
    { fetchPolicy: "store-and-network" }
  );

  const experiment: ExperimentCostAndLatencySummaryExperiment | null =
    useMemo(() => {
      if (data.experiment.__typename !== "Experiment") {
        return null;
      }
      return {
        id: data.experiment.id,
        averageRunLatencyMs: data.experiment.averageRunLatencyMs,
        runCount: data.experiment.runCount,
        costSummary: data.experiment.costSummary,
      };
    }, [data.experiment]);

  return (
    <ExperimentCostAndLatencySummary
      executionState="complete"
      experiment={experiment}
    />
  );
}
