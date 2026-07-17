import type { ComponentType } from "react";

import { ChartPanel, type ChartTypeIconType } from "@phoenix/components/chart";
import type {
  BuiltInProjectMetricChartKey,
  ProjectMetricChartKey,
} from "@phoenix/pages/project/constants";
import {
  getProjectEvaluationMetricChartInfo,
  PROJECT_METRIC_CHART_KEYS,
} from "@phoenix/pages/project/constants";

import { LLMSpanCountTimeSeries } from "./LLMSpanCountTimeSeries";
import { LLMSpanErrorsTimeSeries } from "./LLMSpanErrorsTimeSeries";
import {
  SessionEvaluationMetricPanel,
  SpanEvaluationMetricPanel,
  TraceEvaluationMetricPanel,
} from "./ProjectEvaluationMetricsGrids";
import { SessionAnnotationScoreTimeSeries } from "./SessionAnnotationScoreTimeSeries";
import { SpanAnnotationScoreTimeSeries } from "./SpanAnnotationScoreTimeSeries";
import { SpanCountTimeSeries } from "./SpanCountTimeSeries";
import { ToolSpanCountTimeSeries } from "./ToolSpanCountTimeSeries";
import { ToolSpanErrorsTimeSeries } from "./ToolSpanErrorsTimeSeries";
import { TopModelsByCost } from "./TopModelsByCost";
import { TopModelsByToken } from "./TopModelsByToken";
import { TraceAnnotationScoreTimeSeries } from "./TraceAnnotationScoreTimeSeries";
import { TraceCountTimeSeries } from "./TraceCountTimeSeries";
import { TraceLatencyPercentilesTimeSeries } from "./TraceLatencyPercentilesTimeSeries";
import { TraceTokenCostTimeSeries } from "./TraceTokenCostTimeSeries";
import {
  TraceCompletionTokenDetailsTimeSeries,
  TracePromptTokenDetailsTimeSeries,
  TraceTokenCountTimeSeries,
} from "./TraceTokenCountTimeSeries";
import type { ProjectMetricViewProps } from "./types";

export type ProjectMetricChart = {
  key: ProjectMetricChartKey;
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
  Panel: ComponentType<ProjectMetricPanelProps>;
};

type ProjectMetricPanelProps = ProjectMetricViewProps & {
  fillHeight?: boolean;
};

type ProjectMetricChartDefinition = Omit<
  ProjectMetricChart,
  "key" | "Panel"
> & {
  Component: ComponentType<ProjectMetricViewProps>;
};

/**
 * The catalog of all project metric charts, keyed by chart key. Every chart
 * here can be rendered on the metrics tab as well as added to the strip of
 * charts above the spans table.
 */
const CHART_DEFINITIONS: Record<
  BuiltInProjectMetricChartKey,
  ProjectMetricChartDefinition
> = {
  traffic: {
    name: "Traffic",
    description: "Spans by status",
    chartType: "bar",
    Component: SpanCountTimeSeries,
  },
  traces: {
    name: "Traces",
    description: "Overall volume of traces",
    chartType: "bar",
    Component: TraceCountTimeSeries,
  },
  latency: {
    name: "Trace latency",
    description: "Latency percentiles",
    chartType: "line",
    Component: TraceLatencyPercentilesTimeSeries,
  },
  cost: {
    name: "Cost",
    description: "Estimated cost in USD",
    chartType: "bar",
    Component: TraceTokenCostTimeSeries,
  },
  top_models_by_cost: {
    name: "Top models by cost",
    description: "Models ranked by estimated cost",
    chartType: "barHorizontal",
    Component: TopModelsByCost,
  },
  tokens: {
    name: "Token usage",
    description: "Tokens by prompt and completion",
    chartType: "bar",
    Component: TraceTokenCountTimeSeries,
  },
  top_models_by_tokens: {
    name: "Top models by tokens",
    description: "Models ranked by token usage",
    chartType: "barHorizontal",
    Component: TopModelsByToken,
  },
  prompt_token_details: {
    name: "Prompt token details",
    description: "Prompt tokens by input, cache, and audio parts",
    chartType: "bar",
    Component: TracePromptTokenDetailsTimeSeries,
  },
  completion_token_details: {
    name: "Completion token details",
    description: "Completion tokens by output, reasoning, and audio parts",
    chartType: "bar",
    Component: TraceCompletionTokenDetailsTimeSeries,
  },
  llm_spans: {
    name: "LLM spans",
    description: "LLM span count over time",
    chartType: "bar",
    Component: LLMSpanCountTimeSeries,
  },
  llm_span_errors: {
    name: "LLM span errors",
    description: "LLM spans with errors over time",
    chartType: "bar",
    Component: LLMSpanErrorsTimeSeries,
  },
  tool_spans: {
    name: "Tool spans",
    description: "Tool span count over time",
    chartType: "bar",
    Component: ToolSpanCountTimeSeries,
  },
  tool_span_errors: {
    name: "Tool span errors",
    description: "Tool spans with errors over time",
    chartType: "bar",
    Component: ToolSpanErrorsTimeSeries,
  },
  span_annotations: {
    name: "Span annotation scores",
    description: "Average span annotation scores",
    chartType: "line",
    Component: SpanAnnotationScoreTimeSeries,
  },
  trace_annotations: {
    name: "Trace annotation scores",
    description: "Average trace annotation scores",
    chartType: "line",
    Component: TraceAnnotationScoreTimeSeries,
  },
  session_annotations: {
    name: "Session annotation scores",
    description: "Average session annotation scores",
    chartType: "line",
    Component: SessionAnnotationScoreTimeSeries,
  },
};

function createProjectMetricPanel({
  name,
  description,
  Component,
}: ProjectMetricChartDefinition): ComponentType<ProjectMetricPanelProps> {
  return function ProjectMetricPanel({ fillHeight = false, ...props }) {
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
  PROJECT_METRIC_CHART_KEYS.map((key) => {
    const definition = CHART_DEFINITIONS[key];
    return [
      key,
      {
        key,
        name: definition.name,
        description: definition.description,
        chartType: definition.chartType,
        Panel: createProjectMetricPanel(definition),
      },
    ];
  })
) as Record<BuiltInProjectMetricChartKey, ProjectMetricChart>;

// Cache generated descriptors so their Panel closures stay stable and a
// stream refresh does not remount a selected evaluation chart.
const EVALUATION_CHARTS_BY_KEY = new Map<
  ProjectMetricChartKey,
  ProjectMetricChart
>();

export const getProjectMetricChart = (
  key: ProjectMetricChartKey
): ProjectMetricChart => {
  const evaluationInfo = getProjectEvaluationMetricChartInfo(key);
  if (evaluationInfo == null) {
    return CHARTS_BY_KEY[key as BuiltInProjectMetricChartKey];
  }
  const cachedChart = EVALUATION_CHARTS_BY_KEY.get(key);
  if (cachedChart != null) {
    return cachedChart;
  }
  const { view, evaluationName } = evaluationInfo;
  const chart: ProjectMetricChart = {
    key,
    name: evaluationName,
    description: "Evaluation results over time",
    chartType: "line",
    Panel: ({ fillHeight = false, ...props }) => {
      const panelProps = { ...props, evaluationName, fillHeight };
      switch (view) {
        case "spans":
          return <SpanEvaluationMetricPanel {...panelProps} />;
        case "traces":
          return <TraceEvaluationMetricPanel {...panelProps} />;
        case "sessions":
          return <SessionEvaluationMetricPanel {...panelProps} />;
      }
    },
  };
  EVALUATION_CHARTS_BY_KEY.set(key, chart);
  return chart;
};

export const getProjectMetricCharts = (
  keys: readonly ProjectMetricChartKey[]
): ProjectMetricChart[] => keys.map(getProjectMetricChart);

/**
 * The project metric charts in display order.
 */
export const PROJECT_METRIC_CHARTS: ProjectMetricChart[] =
  getProjectMetricCharts(PROJECT_METRIC_CHART_KEYS);
