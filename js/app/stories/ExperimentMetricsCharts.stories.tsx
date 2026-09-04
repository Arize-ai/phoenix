import type { Meta, StoryObj } from "@storybook/react";
import { Suspense } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";

import type { ExperimentMetricChartKey } from "@phoenix/pages/dataset/constants";
import {
  EXPERIMENT_METRIC_CHARTS,
  getExperimentMetricChart,
} from "@phoenix/pages/dataset/metrics/chartCatalog";

const STORY_DATASET_ID = "dataset:experiment-metrics-story";
const LONG_EXPERIMENT_NAME =
  "candidate 101 — deliberately long experiment name for testing tooltip max width, text overflow, flex shrinking, and CSS ellipsis behavior";
const LONG_UNBROKEN_EXPERIMENT_NAME =
  "candidate_101_deliberately_unbroken_experiment_name_for_issue_14695_testing_css_text_overflow_ellipsis_max_width_flex_shrink_behavior_with_a_single_continuous_identifier_that_has_no_whitespace_or_natural_break_points";

type AnnotationSummaryFixture = {
  annotationName: string;
  meanScore: number | null;
};

type ExperimentFixture = {
  id: string;
  name: string;
  sequenceNumber: number;
  averageRunLatencyMs: number | null;
  errorRate: number | null;
  runCount: number;
  annotationSummaries: AnnotationSummaryFixture[];
  costSummary: {
    prompt: {
      tokens: number | null;
      cost: number | null;
    };
    completion: {
      tokens: number | null;
      cost: number | null;
    };
    total: {
      tokens: number | null;
      cost: number | null;
    };
  };
};

const experiments: ExperimentFixture[] = [
  {
    id: "experiment:101",
    name: "GPT-4.1 baseline",
    sequenceNumber: 101,
    averageRunLatencyMs: 1820,
    errorRate: 0.08,
    runCount: 50,
    annotationSummaries: [
      { annotationName: "correctness", meanScore: 0.72 },
      { annotationName: "relevance", meanScore: 0.81 },
      { annotationName: "helpfulness", meanScore: 0.76 },
    ],
    costSummary: {
      prompt: { tokens: 64_200, cost: 0.1284 },
      completion: { tokens: 18_400, cost: 0.1472 },
      total: { tokens: 82_600, cost: 0.2756 },
    },
  },
  {
    id: "experiment:102",
    name: "Shorter system prompt",
    sequenceNumber: 102,
    averageRunLatencyMs: 1490,
    errorRate: 0.04,
    runCount: 50,
    annotationSummaries: [
      { annotationName: "correctness", meanScore: 0.79 },
      { annotationName: "relevance", meanScore: 0.84 },
      { annotationName: "helpfulness", meanScore: 0.8 },
    ],
    costSummary: {
      prompt: { tokens: 51_800, cost: 0.1036 },
      completion: { tokens: 17_900, cost: 0.1432 },
      total: { tokens: 69_700, cost: 0.2468 },
    },
  },
  {
    id: "experiment:103",
    name: "Retrieval reranking",
    sequenceNumber: 103,
    averageRunLatencyMs: 2110,
    errorRate: 0.02,
    runCount: 50,
    annotationSummaries: [
      { annotationName: "correctness", meanScore: 0.86 },
      { annotationName: "relevance", meanScore: 0.91 },
      { annotationName: "helpfulness", meanScore: 0.88 },
    ],
    costSummary: {
      prompt: { tokens: 70_100, cost: 0.1402 },
      completion: { tokens: 19_600, cost: 0.1568 },
      total: { tokens: 89_700, cost: 0.297 },
    },
  },
  {
    id: "experiment:104",
    name: "Compact context window",
    sequenceNumber: 104,
    averageRunLatencyMs: 1320,
    errorRate: 0.06,
    runCount: 50,
    annotationSummaries: [
      { annotationName: "correctness", meanScore: 0.83 },
      { annotationName: "relevance", meanScore: 0.87 },
      { annotationName: "helpfulness", meanScore: 0.9 },
    ],
    costSummary: {
      prompt: { tokens: 43_700, cost: 0.0874 },
      completion: { tokens: 20_200, cost: 0.1616 },
      total: { tokens: 63_900, cost: 0.249 },
    },
  },
];

type MetricsDataState = "populated" | "empty" | "longExperimentNames";

function getExperimentsForDataState(
  dataState: MetricsDataState
): ExperimentFixture[] {
  if (dataState === "empty") {
    return [];
  }
  if (dataState === "longExperimentNames") {
    return experiments.map((experiment, index) =>
      index === 0
        ? { ...experiment, name: LONG_EXPERIMENT_NAME }
        : index === 1
          ? { ...experiment, name: LONG_UNBROKEN_EXPERIMENT_NAME }
          : experiment
    );
  }
  return experiments;
}

function createMetricsResponse(dataState: MetricsDataState) {
  const metricsExperiments = getExperimentsForDataState(dataState);
  const baselineExperiment = metricsExperiments[0] ?? null;

  return {
    data: {
      dataset: {
        __typename: "Dataset",
        id: STORY_DATASET_ID,
        baselineExperiment,
        metricsExperiments: {
          edges: metricsExperiments.map((experiment) => ({ experiment })),
        },
      },
    },
  };
}

function createRelayEnvironment(dataState: MetricsDataState) {
  return new Environment({
    network: Network.create(async () => createMetricsResponse(dataState)),
    store: new Store(new RecordSource()),
  });
}

const relayEnvironments: Record<MetricsDataState, Environment> = {
  populated: createRelayEnvironment("populated"),
  empty: createRelayEnvironment("empty"),
  longExperimentNames: createRelayEnvironment("longExperimentNames"),
};

type ExperimentMetricsChartsStoryProps = {
  chartKeys: ExperimentMetricChartKey[];
  dataState: MetricsDataState;
};

function ExperimentMetricsChartsStory({
  chartKeys,
  dataState,
}: ExperimentMetricsChartsStoryProps) {
  return (
    <RelayEnvironmentProvider environment={relayEnvironments[dataState]}>
      <Suspense fallback={<div>Loading experiment metrics…</div>}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              chartKeys.length === 1
                ? "minmax(0, 720px)"
                : "repeat(2, minmax(360px, 1fr))",
            gap: "var(--global-dimension-size-200)",
            width: "min(1100px, 100%)",
          }}
        >
          {chartKeys.map((chartKey) => {
            const { annotationName, Panel } =
              getExperimentMetricChart(chartKey);
            return (
              <Panel
                key={chartKey}
                datasetId={STORY_DATASET_ID}
                annotationName={annotationName}
              />
            );
          })}
        </div>
      </Suspense>
    </RelayEnvironmentProvider>
  );
}

const allChartKeys = EXPERIMENT_METRIC_CHARTS.map(({ key }) => key);

const meta: Meta<typeof ExperimentMetricsChartsStory> = {
  title: "Charting/Experiment Metrics Charts",
  component: ExperimentMetricsChartsStory,
  parameters: {
    layout: "padded",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof ExperimentMetricsChartsStory>;

/**
 * All five metric charts with representative experiment data, including a
 * baseline reference and multiple annotation series.
 */
export const AllMetrics: Story = {
  args: {
    chartKeys: allChartKeys,
    dataState: "populated",
  },
};

export const AnnotationScores: Story = {
  args: {
    chartKeys: ["annotation_scores"],
    dataState: "populated",
  },
};

export const Latency: Story = {
  args: {
    chartKeys: ["latency"],
    dataState: "populated",
  },
};

export const Cost: Story = {
  args: {
    chartKeys: ["cost"],
    dataState: "populated",
  },
};

export const TokenUsage: Story = {
  args: {
    chartKeys: ["tokens"],
    dataState: "populated",
  },
};

export const ErrorRate: Story = {
  args: {
    chartKeys: ["error_rate"],
    dataState: "populated",
  },
};

/**
 * The chart caller provides both naturally wrapping and continuous experiment
 * names so the real tooltip-header overflow behavior can be inspected.
 */
export const LongExperimentNameTooltip: Story = {
  args: {
    chartKeys: ["latency"],
    dataState: "longExperimentNames",
  },
};

/**
 * Exercises each chart's metric-specific no-data overlay.
 */
export const EmptyStates: Story = {
  args: {
    chartKeys: allChartKeys,
    dataState: "empty",
  },
};
