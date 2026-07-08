import { css } from "@emotion/react";
import { memo } from "react";
import { useParams } from "react-router";

import { Flex, useTimeRange } from "@phoenix/components";
import { ChartPanel } from "@phoenix/components/chart";
import type { ProjectMetricChartKey } from "@phoenix/pages/project/constants";

import { getProjectMetricChart } from "./chartCatalog";
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
  ["span_annotations"],
  ["trace_annotations"],
  ["session_annotations"],
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
        overflow-y: auto;
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
        gap: var(--global-dimension-size-200);
        padding: var(--global-dimension-size-200);
      `}
    >
      {METRIC_PAGE_ROWS.map((row) => (
        <Flex direction="row" gap="size-200" key={row.join("+")}>
          {row.map((chartKey) => {
            const { name, description, Component } =
              getProjectMetricChart(chartKey);
            return (
              <ChartPanel key={chartKey} title={name} subtitle={description}>
                <Component
                  projectId={projectId}
                  timeRange={timeRange}
                  onTimeRangeSelected={onTimeRangeSelected}
                />
              </ChartPanel>
            );
          })}
        </Flex>
      ))}
    </div>
  );
});
