import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import {
  ChartEmptyStateOverlay,
  ChartResponsiveContainer,
  InteractiveLegend,
  compactChartMargin,
  compactLegendProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  useInteractiveLegend,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import { latencyMsFormatter } from "@phoenix/utils/numberFormatUtils";

import {
  ExperimentBaselineValueLine,
  getExperimentBaselineLegendItems,
} from "./ExperimentBaselineReference";
import { useExperimentChartDatum } from "./experimentMetricsSelection";
import { makeExperimentMetricsTooltipContent } from "./ExperimentMetricsTooltipContent";
import {
  experimentMetricsYAxisProps,
  getExperimentXAxisProps,
} from "./experimentXAxisProps";
import type { ExperimentMetricViewProps } from "./types";
import { EXPERIMENT_METRICS_CHART_SYNC_ID } from "./types";
import { useExperimentMetricsData } from "./useExperimentMetricsData";

const TooltipContent = makeExperimentMetricsTooltipContent({
  valueFormatter: latencyMsFormatter,
});
const LATENCY_DATA_KEY = "latency";

/**
 * Average run latency per experiment.
 */
export function ExperimentLatencyChart({
  datasetId,
  selection,
}: ExperimentMetricViewProps) {
  const { experiments, baselineExperiment } = useExperimentMetricsData({
    datasetId,
    selection,
  });
  const { referenceLabel, toExperimentChartDatum } =
    useExperimentChartDatum(selection);
  const chartData = experiments.map((experiment) => ({
    ...toExperimentChartDatum(experiment),
    latency: experiment.averageRunLatencyMs,
  }));
  const hasData = chartData.some((datum) => typeof datum.latency === "number");

  const { gray300 } = useSequentialChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  const baselineLatency = isDataKeyHidden(LATENCY_DATA_KEY)
    ? null
    : baselineExperiment?.averageRunLatencyMs;
  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasData}
      message="No latency data"
      chartType="bar"
    >
      <ChartResponsiveContainer>
        <BarChart
          data={chartData}
          margin={compactChartMargin}
          barSize={10}
          syncId={EXPERIMENT_METRICS_CHART_SYNC_ID}
          syncMethod="value"
        >
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis
            {...getExperimentXAxisProps({
              baselineSequenceNumber: baselineExperiment?.sequenceNumber,
              experiments: chartData,
            })}
          />
          <YAxis
            {...experimentMetricsYAxisProps}
            tickFormatter={(x) => latencyMsFormatter(x)}
          />
          <Tooltip content={TooltipContent} {...defaultTooltipProps} />
          <ExperimentBaselineValueLine value={baselineLatency} />
          <Bar
            dataKey={LATENCY_DATA_KEY}
            name="average latency"
            fill={gray300}
            hide={isDataKeyHidden(LATENCY_DATA_KEY)}
            radius={[2, 2, 0, 0]}
          />
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconSize={8}
            onToggleDataKey={toggleDataKey}
            additionalLegendItems={getExperimentBaselineLegendItems({
              value: baselineLatency,
              label: referenceLabel,
            })}
          />
        </BarChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
