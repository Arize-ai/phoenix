import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import {
  ChartEmptyStateOverlay,
  ChartResponsiveContainer,
  ChartTooltipItem,
  InteractiveLegend,
  compactChartMargin,
  compactLegendProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  useInteractiveLegend,
  useSemanticChartColors,
} from "@phoenix/components/chart";
import {
  intFormatter,
  percentFormatter,
} from "@phoenix/utils/numberFormatUtils";

import {
  ExperimentBaselineValueLine,
  getExperimentBaselineLegendItems,
} from "./ExperimentBaselineReference";
import { useExperimentChartDatum } from "./experimentMetricsSelection";
import {
  type ExperimentMetricsTooltipDatum,
  makeExperimentMetricsTooltipContent,
} from "./ExperimentMetricsTooltipContent";
import {
  experimentMetricsYAxisProps,
  getExperimentXAxisProps,
} from "./experimentXAxisProps";
import type { ExperimentMetricViewProps } from "./types";
import { EXPERIMENT_METRICS_CHART_SYNC_ID } from "./types";
import { useExperimentMetricsData } from "./useExperimentMetricsData";

const TooltipContent = makeExperimentMetricsTooltipContent<
  ExperimentMetricsTooltipDatum & { runCount: number }
>({
  valueFormatter: percentFormatter,
  renderDetails: ({ runCount }) => (
    <ChartTooltipItem
      color="transparent"
      shape="circle"
      name="runs"
      value={intFormatter(runCount)}
    />
  ),
});
const ERROR_RATE_DATA_KEY = "errorRate";

/**
 * The share of runs that errored per experiment.
 */
export function ExperimentErrorRateChart({
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
    runCount: experiment.runCount,
    errorRate:
      typeof experiment.errorRate === "number"
        ? experiment.errorRate * 100
        : null,
  }));
  const hasRuns = experiments.some((experiment) => experiment.runCount > 0);
  // Runs with zero errors would otherwise draw as a blank chart, so surface
  // it as an explicit (good news) empty state
  const hasErrors = chartData.some((datum) => (datum.errorRate ?? 0) > 0);

  const semanticChartColors = useSemanticChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  const baselineErrorRate = isDataKeyHidden(ERROR_RATE_DATA_KEY)
    ? null
    : baselineExperiment?.errorRate != null
      ? baselineExperiment.errorRate * 100
      : null;
  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasErrors}
      message={hasRuns ? "No errors" : "No data"}
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
            tickFormatter={(x) => percentFormatter(x)}
          />
          <Tooltip content={TooltipContent} {...defaultTooltipProps} />
          <ExperimentBaselineValueLine value={baselineErrorRate} />
          <Bar
            dataKey={ERROR_RATE_DATA_KEY}
            name="error rate"
            fill={semanticChartColors.danger}
            hide={isDataKeyHidden(ERROR_RATE_DATA_KEY)}
            radius={[2, 2, 0, 0]}
          />
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconSize={8}
            onToggleDataKey={toggleDataKey}
            additionalLegendItems={getExperimentBaselineLegendItems({
              value: baselineErrorRate,
              label: referenceLabel,
            })}
          />
        </BarChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
