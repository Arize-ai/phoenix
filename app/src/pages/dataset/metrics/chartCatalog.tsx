import type { ReactNode } from "react";

import type { ChartTypeIconType } from "@phoenix/components/chart";
import type {
  BuiltInExperimentMetricChartKey,
  ExperimentMetricChartKey,
} from "@phoenix/pages/dataset/constants";
import {
  EXPERIMENT_METRIC_CHART_KEYS,
  EXPERIMENT_METRICS_EXPERIMENT_COUNT,
  getExperimentEvaluationName,
} from "@phoenix/pages/dataset/constants";

import { ExperimentAnnotationScoresChart } from "./ExperimentAnnotationScoresChart";
import { ExperimentCostChart } from "./ExperimentCostChart";
import { ExperimentErrorRateChart } from "./ExperimentErrorRateChart";
import { ExperimentEvaluationMetricPanel } from "./ExperimentEvaluationMetricsGrid";
import { ExperimentLatencyChart } from "./ExperimentLatencyChart";
import { ExperimentTokensChart } from "./ExperimentTokensChart";
import type { ExperimentMetricViewProps } from "./types";

export type ExperimentMetricChart = {
  key: ExperimentMetricChartKey;
  /**
   * Shown as the chart panel title
   */
  name: string;
  /**
   * Shown as the chart panel subtitle
   */
  description: string;
  /**
   * The chart's visual archetype, shown as a glyph in the chart selector
   */
  chartType: ChartTypeIconType;
  /** The component supplies its own ChartPanel, including custom actions. */
  isPanelComponent?: boolean;
  Component: (props: ExperimentMetricViewProps) => ReactNode;
};

/**
 * The catalog of all experiment metric charts, keyed by chart key. Every
 * chart plots the dataset's most recent experiments on the x axis.
 */
const CHART_DEFINITIONS: Record<
  BuiltInExperimentMetricChartKey,
  Omit<ExperimentMetricChart, "key">
> = {
  annotation_scores: {
    name: "Annotation scores",
    description: `Annotation scores across the last ${EXPERIMENT_METRICS_EXPERIMENT_COUNT} experiments`,
    chartType: "line",
    Component: ExperimentAnnotationScoresChart,
  },
  latency: {
    name: "Run latency",
    description: `Average run latency across the last ${EXPERIMENT_METRICS_EXPERIMENT_COUNT} experiments`,
    chartType: "bar",
    Component: ExperimentLatencyChart,
  },
  cost: {
    name: "Cost",
    description: `Estimated cost in USD across the last ${EXPERIMENT_METRICS_EXPERIMENT_COUNT} experiments`,
    chartType: "bar",
    Component: ExperimentCostChart,
  },
  tokens: {
    name: "Token usage",
    description: `Prompt and completion tokens across the last ${EXPERIMENT_METRICS_EXPERIMENT_COUNT} experiments`,
    chartType: "bar",
    Component: ExperimentTokensChart,
  },
  error_rate: {
    name: "Error rate",
    description: `Share of runs that errored across the last ${EXPERIMENT_METRICS_EXPERIMENT_COUNT} experiments`,
    chartType: "bar",
    Component: ExperimentErrorRateChart,
  },
};

/**
 * The canonical chart objects, built once so repeated lookups return stable
 * references.
 */
const CHARTS_BY_KEY = Object.fromEntries(
  EXPERIMENT_METRIC_CHART_KEYS.map((key) => [
    key,
    { key, ...CHART_DEFINITIONS[key] },
  ])
) as Record<BuiltInExperimentMetricChartKey, ExperimentMetricChart>;

// Cache generated descriptors so their Component closures stay stable and a
// table refresh does not remount a selected evaluation chart.
const EVALUATION_CHARTS_BY_KEY = new Map<
  ExperimentMetricChartKey,
  ExperimentMetricChart
>();

export const getExperimentMetricChart = (
  key: ExperimentMetricChartKey
): ExperimentMetricChart => {
  const evaluationName = getExperimentEvaluationName(key);
  if (evaluationName == null) {
    return CHARTS_BY_KEY[key as BuiltInExperimentMetricChartKey];
  }
  const cachedChart = EVALUATION_CHARTS_BY_KEY.get(key);
  if (cachedChart != null) {
    return cachedChart;
  }
  const chart: ExperimentMetricChart = {
    key,
    name: evaluationName,
    description: "Evaluation results by experiment",
    chartType: "line",
    isPanelComponent: true,
    Component: (props) => (
      <ExperimentEvaluationMetricPanel
        {...props}
        evaluationName={evaluationName}
        fillHeight
      />
    ),
  };
  EVALUATION_CHARTS_BY_KEY.set(key, chart);
  return chart;
};

export const getExperimentMetricCharts = (
  keys: readonly ExperimentMetricChartKey[]
): ExperimentMetricChart[] => keys.map(getExperimentMetricChart);

/**
 * All the experiment metric charts, in chart selector display order.
 */
export const EXPERIMENT_METRIC_CHARTS: ExperimentMetricChart[] =
  getExperimentMetricCharts(EXPERIMENT_METRIC_CHART_KEYS);
