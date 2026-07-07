import type { TooltipContentProps } from "recharts";
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
  ChartTooltip,
  ChartTooltipItem,
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
import { ExperimentMetricsTooltipHeader } from "./ExperimentMetricsTooltipHeader";
import type { ExperimentMetricViewProps } from "./types";
import { EXPERIMENT_METRICS_CHART_SYNC_ID } from "./types";

function TooltipContent({ active, payload, label }: TooltipContentProps) {
  const { blue500 } = useSequentialChartColors();
  if (active && payload && payload.length) {
    const datum = payload[0]?.payload as { experimentName?: string };
    return (
      <ChartTooltip>
        <ExperimentMetricsTooltipHeader
          sequenceNumber={Number(label)}
          name={datum?.experimentName}
        />
        <ChartTooltipItem
          color={blue500}
          shape="circle"
          name="average latency"
          value={latencyMsFormatter(Number(payload[0]?.value))}
        />
      </ChartTooltip>
    );
  }

  return null;
}

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
          <Bar dataKey="latency" fill={blue500} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
