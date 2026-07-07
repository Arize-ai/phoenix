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
  useSemanticChartColors,
} from "@phoenix/components/chart";
import { percentFormatter } from "@phoenix/utils/numberFormatUtils";

import {
  getExperimentXAxisProps,
  useExperimentMetricsData,
} from "./ExperimentMetrics";
import { ExperimentMetricsTooltipHeader } from "./ExperimentMetricsTooltipHeader";
import type { ExperimentMetricViewProps } from "./types";
import { EXPERIMENT_METRICS_CHART_SYNC_ID } from "./types";

function TooltipContent({ active, payload, label }: TooltipContentProps) {
  const { danger } = useSemanticChartColors();
  if (active && payload && payload.length) {
    const datum = payload[0]?.payload as { experimentName?: string };
    return (
      <ChartTooltip>
        <ExperimentMetricsTooltipHeader
          sequenceNumber={Number(label)}
          name={datum?.experimentName}
        />
        <ChartTooltipItem
          color={danger}
          shape="circle"
          name="error rate"
          value={percentFormatter(Number(payload[0]?.value))}
        />
      </ChartTooltip>
    );
  }

  return null;
}

/**
 * The share of runs that errored per experiment.
 */
export function ExperimentErrorRateChart({
  datasetId,
}: ExperimentMetricViewProps) {
  const { experiments } = useExperimentMetricsData(datasetId);
  const chartData = experiments.map((experiment) => ({
    sequenceNumber: experiment.sequenceNumber,
    experimentName: experiment.name,
    errorRate:
      typeof experiment.errorRate === "number"
        ? experiment.errorRate * 100
        : null,
  }));
  const hasRuns = experiments.some((experiment) => experiment.runCount > 0);
  // Runs with zero errors would otherwise draw as a blank chart, so surface
  // it as an explicit (good news) empty state
  const hasErrors = chartData.some((datum) => (datum.errorRate ?? 0) > 0);

  const SemanticChartColors = useSemanticChartColors();
  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasErrors}
      message={hasRuns ? "No errors" : "No data"}
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
            tickFormatter={(x) => percentFormatter(x)}
          />
          <Tooltip content={TooltipContent} {...defaultTooltipProps} />
          <Bar
            dataKey="errorRate"
            fill={SemanticChartColors.danger}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
