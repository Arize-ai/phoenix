import type { Meta, StoryObj } from "@storybook/react";

import { Flex, View } from "@phoenix/components";
import type { AnnotationConfig } from "@phoenix/components/annotation";
import {
  ExperimentAnnotationAggregates,
  ExperimentCostAndLatencySummary,
  ExperimentRunCellAnnotationsList,
} from "@phoenix/components/experiment";
import type { ExperimentCostAndLatencySummaryExperiment } from "@phoenix/components/experiment/ExperimentCostAndLatencySummary";
import type {
  DeltaDisplay,
  MetricDelta,
} from "@phoenix/components/experiment/experimentDeltaUtils";
import {
  computeLabelDelta,
  computeMetricDelta,
  DEFAULT_RELATIVE_NEUTRAL_THRESHOLD,
} from "@phoenix/components/experiment/experimentDeltaUtils";
import {
  ExperimentLabelDelta,
  ExperimentMetricDelta,
} from "@phoenix/components/experiment/ExperimentMetricDelta";
import {
  costFormatter,
  floatFormatter,
  latencyMsFormatter,
} from "@phoenix/utils/numberFormatUtils";

import { OptionGrid } from "../../utils/OptionGrid";

const statusConfig: AnnotationConfig = {
  name: "status",
  annotationType: "CATEGORICAL",
  optimizationDirection: "MAXIMIZE",
  values: [
    { label: "ok", score: 1 },
    { label: "warning", score: 0.5 },
    { label: "error", score: 0 },
  ],
};

type MetricCase = {
  label: string;
  metricLabel: string;
  delta: MetricDelta;
  formatter: (value: number) => string;
  compareValueText?: string;
  baseValueText?: string;
  note?: string;
};

const metricCases: MetricCase[] = [
  {
    label: "Improved",
    metricLabel: "Total cost",
    delta: computeMetricDelta({
      base: 1.48,
      compare: 0.89,
      optimizationDirection: "MINIMIZE",
    }),
    formatter: costFormatter,
    compareValueText: "$0.89",
    baseValueText: "$1.48",
  },
  {
    label: "Regressed",
    metricLabel: "tool_count",
    delta: computeMetricDelta({
      base: 8,
      compare: 10,
      optimizationDirection: "MINIMIZE",
    }),
    formatter: floatFormatter,
    compareValueText: "10.00",
    baseValueText: "8.00",
  },
  {
    label: "Neutral, inside the 1% band",
    metricLabel: "Latency",
    delta: computeMetricDelta({
      base: 74_000,
      compare: 74_500,
      optimizationDirection: "MINIMIZE",
      neutralThreshold: DEFAULT_RELATIVE_NEUTRAL_THRESHOLD,
    }),
    formatter: latencyMsFormatter,
    compareValueText: "1m 14s",
    baseValueText: "1m 14s",
  },
  {
    label: "Neutral, no direction",
    metricLabel: "coverage",
    delta: computeMetricDelta({
      base: 0.4,
      compare: 0.52,
      optimizationDirection: undefined,
    }),
    formatter: floatFormatter,
    compareValueText: "0.52",
    baseValueText: "0.40",
    note: "No optimization direction set",
  },
  {
    label: "Unchanged",
    metricLabel: "reward",
    delta: computeMetricDelta({
      base: 1,
      compare: 1,
      optimizationDirection: "MAXIMIZE",
    }),
    formatter: floatFormatter,
    compareValueText: "1.00",
    baseValueText: "1.00",
  },
  {
    label: "Undefined",
    metricLabel: "coverage",
    delta: computeMetricDelta({
      base: null,
      compare: 0.8,
      optimizationDirection: undefined,
    }),
    formatter: floatFormatter,
    note: "The base run did not score coverage",
  },
  {
    label: "Base is 0",
    metricLabel: "Total cost",
    delta: computeMetricDelta({
      base: 0,
      compare: 0.12,
      optimizationDirection: "MINIMIZE",
    }),
    formatter: costFormatter,
    compareValueText: "$0.12",
    baseValueText: "$0",
  },
];

const displays: { label: DeltaDisplay; code: true }[] = [
  { label: "relative", code: true },
  { label: "absolute", code: true },
];

const sizes: { label: "S" | "XS"; code: true }[] = [
  { label: "S", code: true },
  { label: "XS", code: true },
];

const labelCases = [
  {
    label: "Improved",
    delta: computeLabelDelta({
      baseLabel: "error",
      compareLabel: "ok",
      config: statusConfig,
    }),
  },
  {
    label: "Regressed",
    delta: computeLabelDelta({
      baseLabel: "ok",
      compareLabel: "error",
      config: statusConfig,
    }),
  },
  {
    label: "Neutral, no label scores",
    delta: computeLabelDelta({ baseLabel: "ok", compareLabel: "error" }),
  },
  {
    label: "Unchanged",
    delta: computeLabelDelta({ baseLabel: "ok", compareLabel: "ok" }),
  },
  {
    label: "Undefined",
    delta: computeLabelDelta({ baseLabel: null, compareLabel: "ok" }),
    note: "The base run has no status label",
  },
];

/**
 * How a compare experiment moved against the base, as one inline token per
 * metric. The arrow carries the sign, the color carries whether the move was
 * good for the metric's optimization direction, and the tooltip carries the
 * base value and both forms of the change. Latency, tokens and cost show the
 * relative change; eval scores show the absolute change; a label shows the
 * label it replaced.
 */
const meta: Meta<typeof ExperimentMetricDelta> = {
  title: "Domains/Experiments/Metric Delta",
  tags: ["updated", "complete", "unreviewed"],
  component: ExperimentMetricDelta,
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof ExperimentMetricDelta>;

export const Default: Story = {
  tags: ["!dev"],
  render: () => (
    <ExperimentMetricDelta
      delta={metricCases[0].delta}
      display="relative"
      metricLabel="Total cost"
      formatter={costFormatter}
      compareValueText="$0.89"
      baseValueText="$1.48"
    />
  ),
};

export const StatesAndDisplays: Story = {
  name: "States and Displays",
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      rows={metricCases}
      columns={displays}
      renderCell={(row, column) => (
        <ExperimentMetricDelta
          delta={row.delta}
          display={column?.label ?? "relative"}
          metricLabel={row.metricLabel}
          formatter={row.formatter}
          compareValueText={row.compareValueText}
          baseValueText={row.baseValueText}
          note={row.note}
        />
      )}
    />
  ),
};

export const StatesAndSizes: Story = {
  name: "States and Sizes",
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      rows={metricCases}
      columns={sizes}
      renderCell={(row, column) => (
        <ExperimentMetricDelta
          delta={row.delta}
          display="relative"
          metricLabel={row.metricLabel}
          formatter={row.formatter}
          compareValueText={row.compareValueText}
          baseValueText={row.baseValueText}
          note={row.note}
          size={column?.label}
        />
      )}
    />
  ),
};

export const LabelChanges: Story = {
  name: "Label Changes",
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      rows={labelCases}
      columns={sizes}
      renderCell={(row, column) => (
        <ExperimentLabelDelta
          delta={row.delta}
          annotationName="status"
          note={row.note}
          size={column?.label}
        />
      )}
    />
  ),
};

const rewardConfig: AnnotationConfig = {
  name: "reward",
  annotationType: "CONTINUOUS",
  optimizationDirection: "MAXIMIZE",
  lowerBound: 0,
  upperBound: 1,
};

const toolCountConfig: AnnotationConfig = {
  name: "tool_count",
  annotationType: "CONTINUOUS",
  optimizationDirection: "MINIMIZE",
  lowerBound: 0,
  upperBound: 40,
};

const coverageConfig: AnnotationConfig = {
  name: "coverage",
  annotationType: "CONTINUOUS",
  optimizationDirection: "NONE",
  lowerBound: 0,
  upperBound: 1,
};

const annotationConfigs = [
  coverageConfig,
  rewardConfig,
  statusConfig,
  toolCountConfig,
];

const baseExperiment: ExperimentCostAndLatencySummaryExperiment & {
  annotationSummaries: { annotationName: string; meanScore: number | null }[];
} = {
  id: "experiment:base",
  averageRunLatencyMs: 111_000,
  runCount: 50,
  costSummary: { total: { cost: 12.0, tokens: 10_500_000 } },
  annotationSummaries: [
    { annotationName: "reward", meanScore: 0.87 },
    { annotationName: "tool_count", meanScore: 20 },
    { annotationName: "status", meanScore: 0.8 },
  ],
};

const compareExperiment: typeof baseExperiment = {
  id: "experiment:compare",
  averageRunLatencyMs: 104_000,
  runCount: 50,
  costSummary: { total: { cost: 8.5, tokens: 8_000_000 } },
  annotationSummaries: [
    { annotationName: "reward", meanScore: 0.91 },
    { annotationName: "tool_count", meanScore: 14.2 },
    { annotationName: "status", meanScore: 0.72 },
    { annotationName: "coverage", meanScore: 0.66 },
  ],
};

const baseRunAnnotations = [
  { id: "base-reward", name: "reward", score: 1, label: null },
  { id: "base-tool-count", name: "tool_count", score: 35, label: null },
  { id: "base-status", name: "status", score: null, label: "ok" },
];

const compareRunAnnotations = [
  { id: "compare-reward", name: "reward", score: 1, label: null },
  { id: "compare-tool-count", name: "tool_count", score: 16, label: null },
  { id: "compare-status", name: "status", score: null, label: "error" },
  { id: "compare-coverage", name: "coverage", score: 0.84, label: null },
];

/**
 * The deltas where the compare grid places them: after each header stat and
 * eval average, and after each eval value in a run cell. The base column
 * shows none.
 */
export const InContext: Story = {
  name: "In Context",
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => (
    <Flex direction="row" gap="size-200" alignItems="start">
      <View
        width="380px"
        borderColor="default"
        borderWidth="thin"
        borderRadius="medium"
        overflow="hidden"
      >
        <View padding="size-200">
          <Flex direction="column" gap="size-50">
            <ExperimentCostAndLatencySummary
              executionState="complete"
              experiment={baseExperiment}
            />
            <ExperimentAnnotationAggregates
              executionState="complete"
              annotationConfigs={annotationConfigs}
              annotationSummaries={baseExperiment.annotationSummaries}
            />
          </Flex>
        </View>
        <ExperimentRunCellAnnotationsList
          annotations={baseRunAnnotations}
          annotationConfigs={annotationConfigs}
        />
      </View>
      <View
        width="480px"
        borderColor="default"
        borderWidth="thin"
        borderRadius="medium"
        overflow="hidden"
      >
        <View padding="size-200">
          <Flex direction="column" gap="size-50">
            <ExperimentCostAndLatencySummary
              executionState="complete"
              experiment={compareExperiment}
              baseExperiment={baseExperiment}
            />
            <ExperimentAnnotationAggregates
              executionState="complete"
              annotationConfigs={annotationConfigs}
              annotationSummaries={compareExperiment.annotationSummaries}
              baseAnnotationSummaries={baseExperiment.annotationSummaries}
            />
          </Flex>
        </View>
        <ExperimentRunCellAnnotationsList
          annotations={compareRunAnnotations}
          annotationConfigs={annotationConfigs}
          showDeltas
          baseAnnotations={baseRunAnnotations}
        />
      </View>
    </Flex>
  ),
};
