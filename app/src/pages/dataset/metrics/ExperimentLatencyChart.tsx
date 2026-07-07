import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartEmptyStateOverlay,
  compactChartMargin,
  compactYAxisProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import { latencyMsFormatter } from "@phoenix/utils/numberFormatUtils";

import {
  getExperimentXAxisProps,
  useExperimentMetricsData,
} from "./ExperimentMetrics";
import { makeExperimentMetricsTooltipContent } from "./ExperimentMetricsTooltipContent";
import type { ExperimentMetricViewProps } from "./types";
import { EXPERIMENT_METRICS_CHART_SYNC_ID } from "./types";

const TooltipContent = makeExperimentMetricsTooltipContent(latencyMsFormatter);

/**
 * Average run latency per experiment.
 */
export function ExperimentLatencyChart({
  datasetId,
}: ExperimentMetricViewProps) {
  const { experiments } = useExperimentMetricsData(datasetId);
  const chartData = experiments.map((experiment) => ({
    sequenceNumber: experiment.sequenceNumber,
    experimentName: experiment.name,
    latency: experiment.averageRunLatencyMs,
  }));
  const hasData = chartData.some((datum) => typeof datum.latency === "number");

  const { blue500 } = useSequentialChartColors();
  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasData}
      message="No latency data"
      chartType="bar"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={compactChartMargin}
          barSize={10}
          syncId={EXPERIMENT_METRICS_CHART_SYNC_ID}
        >
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis {...getExperimentXAxisProps(experiments)} />
          <YAxis
            {...compactYAxisProps}
            tickFormatter={(x) => latencyMsFormatter(x)}
          />
          <Tooltip content={TooltipContent} {...defaultTooltipProps} />
          <Bar
            dataKey="latency"
            name="average latency"
            fill={blue500}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
