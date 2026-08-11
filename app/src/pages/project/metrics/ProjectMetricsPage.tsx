import { css } from "@emotion/react";
import { memo } from "react";
import { useParams } from "react-router";

import { Flex, useTimeRange } from "@phoenix/components";
import type { ProjectMetricChartKey } from "@phoenix/pages/project/constants";

import {
  DeferredProjectMetricPanel,
  getProjectMetricChart,
} from "./chartCatalog";
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
    <main
      css={css`
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        /* Scrolls in both directions: the rows hold their charts at a
           readable width rather than shrinking to fit a narrow window */
        overflow: auto;
      `}
    >
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
    <div
      css={css`
        display: flex;
        flex-direction: column;
        container-type: inline-size;
        gap: var(--global-dimension-size-200);
        padding: var(--global-dimension-size-200);
        /* The widest row's charts at their minimum width. Every row stretches
           to it, so a scrolled page keeps its charts aligned in a column. */
        min-width: min-content;
      `}
    >
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
