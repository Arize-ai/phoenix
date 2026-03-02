import { css, keyframes } from "@emotion/react";
import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, ProgressBar, Text } from "@phoenix/components";
import {
  AnnotationColorSwatch,
  type AnnotationConfig,
  AnnotationScoreText,
  getOptimizationBounds,
  getPositiveOptimizationFromConfig,
} from "@phoenix/components/annotation";
import type { ExecutionState } from "@phoenix/components/types";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { useWordColor } from "@phoenix/hooks";
import { calculateAnnotationScorePercentile } from "@phoenix/pages/experiment/utils";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import type { ExperimentAnnotationAggregatesQuery } from "./__generated__/ExperimentAnnotationAggregatesQuery.graphql";

/**
 * The shape of annotation summary data needed to render aggregates.
 */
export type AnnotationSummary = {
  annotationName: string;
  meanScore: number | null;
};

type ExperimentAnnotationAggregatesProps = {
  /**
   * The current execution state
   * - idle: No experiment has been run yet (shows placeholder with --)
   * - running: Experiment is in progress (shows skeleton loaders)
   * - complete: Experiment finished (shows actual data)
   */
  executionState: ExecutionState;
  /**
   * Configs for all expected annotations/evaluators.
   * Used to show names and maintain consistent ordering.
   */
  annotationConfigs: readonly AnnotationConfig[];
  /**
   * Annotation summaries with mean scores (required when executionState is "complete")
   */
  annotationSummaries?: readonly AnnotationSummary[];
  /**
   * Whether this is a placeholder in a non-experiment column (e.g., reference output).
   * When true, renders with reduced opacity.
   */
  isPlaceholder?: boolean;
};

const pulseKeyframes = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
`;

const inProgressCSS = css`
  animation: ${pulseKeyframes} 2s ease-in-out 0.5s infinite;
`;

const listCSS = css`
  display: grid;
  grid-template-columns:
    minmax(100px, max-content) minmax(70px, max-content)
    minmax(100px, 1fr);
  column-gap: var(--global-dimension-size-100);
`;

const listItemCSS = css`
  height: var(--global-dimension-size-350);
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: center;
`;

const placeholderCSS = css`
  opacity: 0.5;
`;

/**
 * Component that displays aggregate annotation scores (averages) in column headers.
 * Handles idle, running (loading), and complete states to prevent layout shifts.
 */
export function ExperimentAnnotationAggregates({
  executionState,
  annotationConfigs,
  annotationSummaries,
  isPlaceholder = false,
}: ExperimentAnnotationAggregatesProps) {
  // Build a map for quick lookup of summaries by name
  const summaryByName = useMemo(() => {
    return (
      annotationSummaries?.reduce(
        (acc, summary) => {
          acc[summary.annotationName] = summary;
          return acc;
        },
        {} as Record<string, AnnotationSummary>
      ) ?? {}
    );
  }, [annotationSummaries]);

  // Don't render if there are no annotation configs
  if (annotationConfigs.length === 0) {
    return null;
  }

  return (
    <ul css={[listCSS, isPlaceholder && placeholderCSS]}>
      {annotationConfigs.map((config) => {
        const summary = summaryByName[config.name];
        const meanScore = summary?.meanScore;

        return (
          <ExperimentAnnotationAggregateItem
            key={config.name}
            config={config}
            meanScore={meanScore}
            executionState={executionState}
          />
        );
      })}
    </ul>
  );
}

/**
 * Individual annotation aggregate item with color swatch, score text, and progress bar.
 * Extracted to allow useWordColor hook per annotation.
 */
function ExperimentAnnotationAggregateItem({
  config,
  meanScore,
  executionState,
}: {
  config: AnnotationConfig;
  meanScore: number | null | undefined;
  executionState: ExecutionState;
}) {
  const annotationColor = useWordColor(config.name);
  const { lowerBound, upperBound } = getOptimizationBounds(config);
  // Default to 0-1 range if bounds not specified
  const min = lowerBound ?? 0;
  const max = upperBound ?? 1;

  const positiveOptimization = getPositiveOptimizationFromConfig({
    config,
    score: meanScore,
  });

  const scorePercentile = calculateAnnotationScorePercentile(
    meanScore ?? 0,
    min,
    max
  );

  return (
    <li css={[listItemCSS, executionState === "running" && inProgressCSS]}>
      {/* Column 1: Color swatch + annotation name */}
      <Flex
        direction="row"
        gap="size-100"
        alignItems="center"
        justifySelf="start"
        minWidth={0}
        maxWidth="100%"
      >
        <span
          css={css`
            flex: none;
          `}
        >
          <AnnotationColorSwatch annotationName={config.name} />
        </span>
        <Text color="inherit" minWidth={0} weight="heavy">
          <Truncate maxWidth="100%">{config.name}</Truncate>
        </Text>
      </Flex>

      {/* Column 2: AVG prefix + score value */}
      <Flex direction="row" gap="size-100" alignItems="center">
        <Text size="S" fontFamily="mono" color="gray-500">
          AVG
        </Text>
        <AnnotationScoreText
          size="S"
          fontFamily="mono"
          positiveOptimization={
            executionState === "idle" ? undefined : positiveOptimization
          }
        >
          <Truncate maxWidth="100%">
            {meanScore != null ? floatFormatter(meanScore) : "--"}
          </Truncate>
        </AnnotationScoreText>
      </Flex>

      {/* Column 3: Progress bar */}
      <ProgressBar
        css={css`
          align-self: center;
          --mod-barloader-fill-color: ${annotationColor};
        `}
        animateFill={executionState !== "idle"}
        value={meanScore != null ? scorePercentile : 0}
        height="var(--global-dimension-size-50)"
        width="100%"
        aria-label={`${config.name} average score`}
      />
    </li>
  );
}

type ConnectedExperimentAnnotationAggregatesProps = {
  /**
   * The id of the experiment to fetch annotation summaries for
   */
  experimentId: string;
  /**
   * Configs for all expected annotations/evaluators.
   * Used to show names and maintain consistent ordering.
   */
  annotationConfigs: readonly AnnotationConfig[];
};

/**
 * Connected component that fetches experiment annotation summaries via GraphQL
 * and renders ExperimentAnnotationAggregates.
 */
export function ConnectedExperimentAnnotationAggregates({
  experimentId,
  annotationConfigs,
}: ConnectedExperimentAnnotationAggregatesProps) {
  const data = useLazyLoadQuery<ExperimentAnnotationAggregatesQuery>(
    graphql`
      query ExperimentAnnotationAggregatesQuery($experimentId: ID!) {
        experiment: node(id: $experimentId) {
          __typename
          ... on Experiment {
            annotationSummaries {
              annotationName
              meanScore
            }
          }
        }
      }
    `,
    { experimentId },
    { fetchPolicy: "store-and-network" }
  );

  const annotationSummaries: readonly AnnotationSummary[] = useMemo(() => {
    if (data.experiment.__typename !== "Experiment") {
      return [];
    }
    return data.experiment.annotationSummaries;
  }, [data.experiment]);

  return (
    <ExperimentAnnotationAggregates
      executionState="complete"
      annotationConfigs={annotationConfigs}
      annotationSummaries={annotationSummaries}
    />
  );
}

/**
 * Skeleton loading state component for ExperimentAnnotationAggregates.
 * Shows the annotation names with skeleton loaders for the values.
 */
export function ExperimentAnnotationAggregatesSkeleton({
  annotationConfigs,
}: {
  annotationConfigs: readonly AnnotationConfig[];
}) {
  return (
    <ExperimentAnnotationAggregates
      executionState="running"
      annotationConfigs={annotationConfigs}
    />
  );
}
