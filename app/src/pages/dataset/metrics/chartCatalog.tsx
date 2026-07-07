import type { ReactNode } from "react";

import type { ChartTypeIconType } from "@phoenix/components/chart";
import type { ExperimentMetricChartKey } from "@phoenix/pages/dataset/constants";
import { EXPERIMENT_METRIC_CHART_KEYS } from "@phoenix/pages/dataset/constants";

import { ExperimentCostChart } from "./ExperimentCostChart";
import { ExperimentErrorRateChart } from "./ExperimentErrorRateChart";
import { ExperimentLatencyChart } from "./ExperimentLatencyChart";
import { ExperimentTokensChart } from "./ExperimentTokensChart";
import type { ExperimentMetricViewProps } from "./types";

export type ExperimentMetricChart = {
  key: ExperimentMetricChartKey;
  /**
   * Shown as the chart panel title and as the chart's name in chart pickers
   */
  name: string;
  /**
   * Shown as the chart panel subtitle and as the chart's description in
   * chart pickers
   */
  description: string;
  /**
   * The chart's visual archetype, used to render a small preview glyph in
   * chart pickers so a chart can be recognized by its shape.
   */
  chartType: ChartTypeIconType;
  Component: (props: ExperimentMetricViewProps) => ReactNode;
};

/**
 * The catalog of all experiment metric charts, keyed by chart key. Every
 * chart plots the dataset's most recent experiments on the x axis.
 */
const CHART_DEFINITIONS: Record<
  ExperimentMetricChartKey,
  Omit<ExperimentMetricChart, "key">
> = {
  latency: {
    name: "Run latency",
    description: "Average run latency by experiment",
    chartType: "bar",
    Component: ExperimentLatencyChart,
  },
  cost: {
    name: "Cost",
    description: "Estimated cost in USD by prompt and completion",
    chartType: "bar",
    Component: ExperimentCostChart,
  },
  tokens: {
    name: "Token usage",
    description: "Tokens by prompt and completion",
    chartType: "bar",
    Component: ExperimentTokensChart,
  },
  error_rate: {
    name: "Error rate",
    description: "Share of runs that errored",
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
) as Record<ExperimentMetricChartKey, ExperimentMetricChart>;

export const getExperimentMetricChart = (
  key: ExperimentMetricChartKey
): ExperimentMetricChart => CHARTS_BY_KEY[key];
