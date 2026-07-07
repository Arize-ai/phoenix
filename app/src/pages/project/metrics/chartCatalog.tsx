import type { ReactNode } from "react";

import type { ChartTypeIconType } from "@phoenix/components/chart";
import type { ProjectMetricChartKey } from "@phoenix/pages/project/constants";
import { PROJECT_METRIC_CHART_KEYS } from "@phoenix/pages/project/constants";

import { LLMSpanCountTimeSeries } from "./LLMSpanCountTimeSeries";
import { LLMSpanErrorsTimeSeries } from "./LLMSpanErrorsTimeSeries";
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
  Component: (props: ProjectMetricViewProps) => ReactNode;
};

/**
 * The catalog of all project metric charts, keyed by chart key. Every chart
 * here can be rendered on the metrics tab as well as added to the strip of
 * charts above the spans table.
 */
const CHART_DEFINITIONS: Record<
  ProjectMetricChartKey,
  Omit<ProjectMetricChart, "key">
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

/**
 * The canonical chart objects, built once so repeated lookups return stable
 * references.
 */
const CHARTS_BY_KEY = Object.fromEntries(
  PROJECT_METRIC_CHART_KEYS.map((key) => [
    key,
    { key, ...CHART_DEFINITIONS[key] },
  ])
) as Record<ProjectMetricChartKey, ProjectMetricChart>;

export const getProjectMetricChart = (
  key: ProjectMetricChartKey
): ProjectMetricChart => CHARTS_BY_KEY[key];

export const getProjectMetricCharts = (
  keys: readonly ProjectMetricChartKey[]
): ProjectMetricChart[] => keys.map(getProjectMetricChart);

/**
 * The project metric charts in display order.
 */
export const PROJECT_METRIC_CHARTS: ProjectMetricChart[] =
  getProjectMetricCharts(PROJECT_METRIC_CHART_KEYS);
