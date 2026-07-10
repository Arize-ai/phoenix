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
  ExperimentBaselineSeparator,
  ExperimentBaselineValueLine,
} from "./ExperimentBaselineReference";
import { makeExperimentMetricsTooltipContent } from "./ExperimentMetricsTooltipContent";
import { getExperimentXAxisProps } from "./experimentXAxisProps";
import type { ExperimentMetricViewProps } from "./types";
import { EXPERIMENT_METRICS_CHART_SYNC_ID } from "./types";
import { useExperimentMetricsData } from "./useExperimentMetricsData";

const TooltipContent = makeExperimentMetricsTooltipContent(latencyMsFormatter);

/**
 * Average run latency per experiment.
 */
export function ExperimentLatencyChart({
  datasetId,
}: ExperimentMetricViewProps) {
  const { experiments, baselineExperiment, isBaselineOutOfWindow } =
    useExperimentMetricsData(datasetId);
  const chartData = experiments.map((experiment) => ({
    sequenceNumber: experiment.sequenceNumber,
    experimentName: experiment.name,
    isBaseline: experiment.isBaseline,
    latency: experiment.averageRunLatencyMs,
  }));
  const hasData = chartData.some((datum) => typeof datum.latency === "number");

  const { gray300 } = useSequentialChartColors();
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
          <XAxis
            {...getExperimentXAxisProps(baselineExperiment?.sequenceNumber)}
          />
          <YAxis
            {...compactYAxisProps}
            tickFormatter={(x) => latencyMsFormatter(x)}
          />
          <Tooltip content={TooltipContent} {...defaultTooltipProps} />
          <ExperimentBaselineValueLine
            value={baselineExperiment?.averageRunLatencyMs}
          />
          {isBaselineOutOfWindow && baselineExperiment && (
            <ExperimentBaselineSeparator
              sequenceNumber={baselineExperiment.sequenceNumber}
            />
          )}
          <Bar
            dataKey="latency"
            name="average latency"
            fill={gray300}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
