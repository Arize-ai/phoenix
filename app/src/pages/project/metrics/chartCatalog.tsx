import type { ReactNode } from "react";

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
    Component: SpanCountTimeSeries,
  },
  traces: {
    name: "Traces",
    description: "Overall volume of traces",
    Component: TraceCountTimeSeries,
  },
  latency: {
    name: "Trace latency",
    description: "Latency percentiles",
    Component: TraceLatencyPercentilesTimeSeries,
  },
  cost: {
    name: "Cost",
    description: "Estimated cost in USD",
    Component: TraceTokenCostTimeSeries,
  },
  top_models_by_cost: {
    name: "Top models by cost",
    description: "Models ranked by estimated cost",
    Component: TopModelsByCost,
  },
  tokens: {
    name: "Token usage",
    description: "Tokens by prompt and completion",
    Component: TraceTokenCountTimeSeries,
  },
  top_models_by_tokens: {
    name: "Top models by tokens",
    description: "Models ranked by token usage",
    Component: TopModelsByToken,
  },
  prompt_token_details: {
    name: "Prompt token details",
    description: "Prompt tokens by input, cache, and audio parts",
    Component: TracePromptTokenDetailsTimeSeries,
  },
  completion_token_details: {
    name: "Completion token details",
    description: "Completion tokens by output, reasoning, and audio parts",
    Component: TraceCompletionTokenDetailsTimeSeries,
  },
  llm_spans: {
    name: "LLM spans",
    description: "LLM span count over time",
    Component: LLMSpanCountTimeSeries,
  },
  llm_span_errors: {
    name: "LLM span errors",
    description: "LLM spans with errors over time",
    Component: LLMSpanErrorsTimeSeries,
  },
  tool_spans: {
    name: "Tool spans",
    description: "Tool span count over time",
    Component: ToolSpanCountTimeSeries,
  },
  tool_span_errors: {
    name: "Tool span errors",
    description: "Tool spans with errors over time",
    Component: ToolSpanErrorsTimeSeries,
  },
  span_annotations: {
    name: "Span annotation scores",
    description: "Average span annotation scores",
    Component: SpanAnnotationScoreTimeSeries,
  },
  trace_annotations: {
    name: "Trace annotation scores",
    description: "Average trace annotation scores",
    Component: TraceAnnotationScoreTimeSeries,
  },
  session_annotations: {
    name: "Session annotation scores",
    description: "Average session annotation scores",
    Component: SessionAnnotationScoreTimeSeries,
  },
};

/**
 * The project metric charts in display order.
 */
export const PROJECT_METRIC_CHARTS: ProjectMetricChart[] =
  PROJECT_METRIC_CHART_KEYS.map((key) => ({
    key,
    ...CHART_DEFINITIONS[key],
  }));

export const getProjectMetricChart = (
  key: ProjectMetricChartKey
): ProjectMetricChart => ({
  key,
  ...CHART_DEFINITIONS[key],
});
