import { memo } from "react";
import { useParams } from "react-router";

import { Flex, useTimeRange } from "@phoenix/components";
import type { ProjectMetricChartKey } from "@phoenix/pages/project/constants";

import {
  DeferredProjectMetricPanel,
  getProjectMetricChart,
} from "./chartCatalog";
import {
  metricsPanelsColumnCSS,
  metricsScrollContainerCSS,
} from "./metricsLayout";
import { ProjectAnnotationMetricsGrid } from "./ProjectAnnotationMetrics";
import { useClosedTimeRange } from "./useClosedTimeRange";

/**
 * The charts from the chart catalog shown on the metrics page, row by row.
 */
const METRIC_PAGE_ROWS: ProjectMetricChartKey[][] = [
  ["traces"],
  ["latency"],
  ["cost", "top_models_by_cost"],
  ["tokens", "top_models_by_tokens"],
  ["prompt_token_details", "completion_token_details"],
  ["llm_spans", "llm_span_errors"],
  ["tool_spans", "tool_span_errors"],
];

export function ProjectMetricsPage() {
  const { projectId } = useParams();
  if (!projectId) {
    throw new Error("projectId is required");
  }

  const timeRange = useClosedTimeRange();
  const { setCustomTimeRange } = useTimeRange();

  return (
    <main css={metricsScrollContainerCSS}>
      <MetricPanels
        projectId={projectId}
        timeRange={timeRange}
        onTimeRangeSelected={setCustomTimeRange}
      />
    </main>
  );
}
const MetricPanels = memo(function MetricPanels({
  projectId,
  timeRange,
  onTimeRangeSelected,
}: {
  projectId: string;
  timeRange: TimeRange;
  onTimeRangeSelected: (timeRange: TimeRange) => void;
}) {
  return (
    <div css={metricsPanelsColumnCSS}>
      {METRIC_PAGE_ROWS.map((row) => (
        <MetricRow
          key={row.join("+")}
          projectId={projectId}
          timeRange={timeRange}
          onTimeRangeSelected={onTimeRangeSelected}
          row={row}
        />
      ))}
      <MetricRow
        projectId={projectId}
        timeRange={timeRange}
        onTimeRangeSelected={onTimeRangeSelected}
        row={["span_annotations"]}
      />
      <ProjectAnnotationMetricsGrid
        annotationLevel="spans"
        projectId={projectId}
        timeRange={timeRange}
        onTimeRangeSelected={onTimeRangeSelected}
      />
      <MetricRow
        projectId={projectId}
        timeRange={timeRange}
        onTimeRangeSelected={onTimeRangeSelected}
        row={["trace_annotations"]}
      />
      <ProjectAnnotationMetricsGrid
        annotationLevel="traces"
        projectId={projectId}
        timeRange={timeRange}
        onTimeRangeSelected={onTimeRangeSelected}
      />
      <MetricRow
        projectId={projectId}
        timeRange={timeRange}
        onTimeRangeSelected={onTimeRangeSelected}
        row={["session_annotations"]}
      />
      <ProjectAnnotationMetricsGrid
        annotationLevel="sessions"
        projectId={projectId}
        timeRange={timeRange}
        onTimeRangeSelected={onTimeRangeSelected}
      />
    </div>
  );
});

function MetricRow({
  projectId,
  timeRange,
  onTimeRangeSelected,
  row,
}: {
  projectId: string;
  timeRange: TimeRange;
  onTimeRangeSelected: (timeRange: TimeRange) => void;
  row: ProjectMetricChartKey[];
}) {
  return (
    <Flex direction="row" gap="size-200">
      {row.map((chartKey) => (
        <DeferredProjectMetricPanel
          key={chartKey}
          chart={getProjectMetricChart(chartKey)}
          projectId={projectId}
          timeRange={timeRange}
          onTimeRangeSelected={onTimeRangeSelected}
        />
      ))}
    </Flex>
  );
}
