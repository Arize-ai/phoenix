import type { ComponentType } from "react";

import { ChartPanel, type ChartTypeIconType } from "@phoenix/components/chart";
import type {
  BuiltInExperimentMetricChartKey,
  ExperimentMetricChartKey,
} from "@phoenix/pages/dataset/constants";
import {
  EXPERIMENT_ANNOTATION_METRIC_CHART_DESCRIPTION,
  EXPERIMENT_METRIC_CHART_KEYS,
  EXPERIMENT_METRICS_EXPERIMENT_COUNT,
  getExperimentAnnotationName,
} from "@phoenix/pages/dataset/constants";

import { ExperimentAnnotationMetricPanel } from "./ExperimentAnnotationMetricsGrid";
import { ExperimentAnnotationScoresChart } from "./ExperimentAnnotationScoresChart";
import { ExperimentCostChart } from "./ExperimentCostChart";
import { ExperimentErrorRateChart } from "./ExperimentErrorRateChart";
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
  Panel: ComponentType<ExperimentMetricPanelProps>;
};

type ExperimentMetricPanelProps = ExperimentMetricViewProps & {
  fillHeight?: boolean;
};

type ExperimentMetricChartDefinition = Omit<
  ExperimentMetricChart,
  "key" | "Panel"
> & {
  Component: ComponentType<ExperimentMetricViewProps>;
};

/**
 * The catalog of all experiment metric charts, keyed by chart key. Every
 * chart plots the dataset's most recent experiments on the x axis.
 */
const CHART_DEFINITIONS: Record<
  BuiltInExperimentMetricChartKey,
  ExperimentMetricChartDefinition
> = {
  annotation_scores: {
    name: "Annotation score comparison",
    description: `Mean scores across all annotations for the last ${EXPERIMENT_METRICS_EXPERIMENT_COUNT} experiments`,
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

function createExperimentMetricPanel({
  name,
  description,
  Component,
}: ExperimentMetricChartDefinition): ComponentType<ExperimentMetricPanelProps> {
  return function ExperimentMetricPanel({ fillHeight = false, ...props }) {
    return (
      <ChartPanel title={name} subtitle={description} fillHeight={fillHeight}>
        <Component {...props} />
      </ChartPanel>
    );
  };
}

/**
 * The canonical chart objects, built once so repeated lookups return stable
 * references.
 */
const CHARTS_BY_KEY = Object.fromEntries(
  EXPERIMENT_METRIC_CHART_KEYS.map((key) => {
    const definition = CHART_DEFINITIONS[key];
    return [
      key,
      {
        key,
        name: definition.name,
        description: definition.description,
        chartType: definition.chartType,
        Panel: createExperimentMetricPanel(definition),
      },
    ];
  })
) as Record<BuiltInExperimentMetricChartKey, ExperimentMetricChart>;

// Cache generated descriptors so their Panel closures stay stable and a
// table refresh does not remount a selected annotation chart.
const ANNOTATION_CHARTS_BY_KEY = new Map<
  ExperimentMetricChartKey,
  ExperimentMetricChart
>();

export const getExperimentMetricChart = (
  key: ExperimentMetricChartKey
): ExperimentMetricChart => {
  const annotationName = getExperimentAnnotationName(key);
  if (annotationName == null) {
    return CHARTS_BY_KEY[key as BuiltInExperimentMetricChartKey];
  }
  const cachedChart = ANNOTATION_CHARTS_BY_KEY.get(key);
  if (cachedChart != null) {
    return cachedChart;
  }
  const chart: ExperimentMetricChart = {
    key,
    name: annotationName,
    description: EXPERIMENT_ANNOTATION_METRIC_CHART_DESCRIPTION,
    chartType: "line",
    Panel: ({ fillHeight = false, ...props }) => (
      <ExperimentAnnotationMetricPanel
        {...props}
        annotationName={annotationName}
        fillHeight={fillHeight}
      />
    ),
  };
  ANNOTATION_CHARTS_BY_KEY.set(key, chart);
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
