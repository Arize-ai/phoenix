import type { ComponentType } from "react";
import invariant from "tiny-invariant";

import {
  ChartPanel,
  type ChartTypeIconType,
  DeferredChartPanel,
} from "@phoenix/components/chart";
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
import {
  ExperimentCompletionTokenDetailsChart,
  ExperimentPromptTokenDetailsChart,
} from "./ExperimentTokenDetailsChart";
import { ExperimentTokensChart } from "./ExperimentTokensChart";
import type { ExperimentSelection, ExperimentMetricViewProps } from "./types";

export type ExperimentMetricChart = {
  key: ExperimentMetricChartKey;
  annotationName?: string;
  /**
   * Shown as the chart panel title
   */
  name: string;
  /**
   * Shown as the chart panel subtitle, for each kind of experiment selection
   */
  description: Record<ExperimentSelection["type"], string>;
  /**
   * The chart's visual archetype, shown as a glyph in the chart selector
   */
  chartType: ChartTypeIconType;
  Panel: ComponentType<ExperimentMetricPanelProps>;
};

type ExperimentMetricPanelProps = ExperimentMetricViewProps & {
  annotationName?: string;
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
 * chart plots the dataset's most recent experiments, or the compared
 * experiments, on the x axis.
 */
const CHART_DEFINITIONS: Record<
  BuiltInExperimentMetricChartKey,
  ExperimentMetricChartDefinition
> = {
  annotation_scores: {
    name: "Annotation score comparison",
    description: {
      recent: `Mean scores across all annotations for the last ${EXPERIMENT_METRICS_EXPERIMENT_COUNT} experiments`,
      compared: "Mean scores across all annotations per experiment",
    },
    chartType: "line",
    Component: ExperimentAnnotationScoresChart,
  },
  latency: {
    name: "Run latency",
    description: {
      recent: `Average run latency across the last ${EXPERIMENT_METRICS_EXPERIMENT_COUNT} experiments`,
      compared: "Average run latency per experiment",
    },
    chartType: "bar",
    Component: ExperimentLatencyChart,
  },
  cost: {
    name: "Cost",
    description: {
      recent: `Estimated cost in USD across the last ${EXPERIMENT_METRICS_EXPERIMENT_COUNT} experiments`,
      compared: "Estimated cost in USD per experiment",
    },
    chartType: "bar",
    Component: ExperimentCostChart,
  },
  tokens: {
    name: "Token usage",
    description: {
      recent: `Prompt and completion tokens across the last ${EXPERIMENT_METRICS_EXPERIMENT_COUNT} experiments`,
      compared: "Prompt and completion tokens per experiment",
    },
    chartType: "bar",
    Component: ExperimentTokensChart,
  },
  prompt_token_details: {
    name: "Prompt token details",
    description: {
      recent: `Prompt tokens by input, cache, and audio parts across the last ${EXPERIMENT_METRICS_EXPERIMENT_COUNT} experiments`,
      compared: "Prompt tokens by input, cache, and audio parts per experiment",
    },
    chartType: "bar",
    Component: ExperimentPromptTokenDetailsChart,
  },
  completion_token_details: {
    name: "Completion token details",
    description: {
      recent: `Completion tokens by output, reasoning, and audio parts across the last ${EXPERIMENT_METRICS_EXPERIMENT_COUNT} experiments`,
      compared:
        "Completion tokens by output, reasoning, and audio parts per experiment",
    },
    chartType: "bar",
    Component: ExperimentCompletionTokenDetailsChart,
  },
  error_rate: {
    name: "Error rate",
    description: {
      recent: `Share of runs that errored across the last ${EXPERIMENT_METRICS_EXPERIMENT_COUNT} experiments`,
      compared: "Share of runs that errored per experiment",
    },
    chartType: "bar",
    Component: ExperimentErrorRateChart,
  },
};

/**
 * The chart's subtitle for the selected experiments it plots
 */
export function getExperimentMetricChartDescription({
  chart,
  experimentSelection,
}: {
  chart: Pick<ExperimentMetricChart, "description">;
  experimentSelection: ExperimentSelection;
}): string {
  return chart.description[experimentSelection.type];
}

function createExperimentMetricPanel(
  definition: ExperimentMetricChartDefinition
): ComponentType<ExperimentMetricPanelProps> {
  const { name, Component } = definition;
  return function ExperimentMetricPanel({ fillHeight = false, ...props }) {
    return (
      <ChartPanel
        title={name}
        subtitle={getExperimentMetricChartDescription({
          chart: definition,
          experimentSelection: props.experimentSelection,
        })}
        fillHeight={fillHeight}
      >
        <Component {...props} />
      </ChartPanel>
    );
  };
}

/**
 * The built-in chart objects, built once so repeated lookups return stable
 * references. Annotation chart objects are derived per lookup from their key;
 * only their shared `Panel` component reference is stable.
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

function ExperimentAnnotationChartPanel({
  annotationName,
  ...props
}: ExperimentMetricPanelProps) {
  invariant(
    annotationName != null,
    "annotationName is required for an annotation metric chart"
  );
  return (
    <ExperimentAnnotationMetricPanel
      {...props}
      annotationName={annotationName}
    />
  );
}

/**
 * A catalog chart wrapped in a {@link DeferredChartPanel} so it doesn't fetch
 * until scrolled into view. The placeholder uses the catalog title and
 * subtitle so it matches the loaded panel.
 */
export function DeferredExperimentMetricPanel({
  chart,
  fillHeight = false,
  ...props
}: ExperimentMetricViewProps & {
  chart: ExperimentMetricChart;
  fillHeight?: boolean;
}) {
  return (
    <DeferredChartPanel
      title={chart.name}
      subtitle={getExperimentMetricChartDescription({
        chart,
        experimentSelection: props.experimentSelection,
      })}
      fillHeight={fillHeight}
    >
      <chart.Panel
        {...props}
        annotationName={chart.annotationName}
        fillHeight={fillHeight}
      />
    </DeferredChartPanel>
  );
}

export const getExperimentMetricChart = (
  key: ExperimentMetricChartKey
): ExperimentMetricChart => {
  const annotationName = getExperimentAnnotationName(key);
  if (annotationName == null) {
    return CHARTS_BY_KEY[key as BuiltInExperimentMetricChartKey];
  }
  return {
    key,
    annotationName,
    name: annotationName,
    description: {
      recent: EXPERIMENT_ANNOTATION_METRIC_CHART_DESCRIPTION,
      compared: EXPERIMENT_ANNOTATION_METRIC_CHART_DESCRIPTION,
    },
    // An annotation's view (line or bars) is only known once its metric data
    // loads, so the catalog shows a neutral line glyph.
    chartType: "line",
    Panel: ExperimentAnnotationChartPanel,
  };
};

export const getExperimentMetricCharts = (
  keys: readonly ExperimentMetricChartKey[]
): ExperimentMetricChart[] => keys.map(getExperimentMetricChart);

/**
 * All the experiment metric charts, in chart selector display order.
 */
export const EXPERIMENT_METRIC_CHARTS: ExperimentMetricChart[] =
  getExperimentMetricCharts(EXPERIMENT_METRIC_CHART_KEYS);
