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
  InteractiveLegend,
  compactChartMargin,
  compactLegendProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  useCategoryChartColors,
  useInteractiveLegend,
} from "@phoenix/components/chart";
import {
  intFormatter,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

import {
  ExperimentBaselineValueLine,
  getExperimentBaselineLegendItems,
} from "./ExperimentBaselineReference";
import { makeExperimentMetricsTooltipContent } from "./ExperimentMetricsTooltipContent";
import {
  experimentMetricsYAxisProps,
  getExperimentXAxisProps,
} from "./experimentXAxisProps";
import type { ExperimentMetricViewProps } from "./types";
import { EXPERIMENT_METRICS_CHART_SYNC_ID } from "./types";
import { useExperimentMetricsData } from "./useExperimentMetricsData";

const TooltipContent = makeExperimentMetricsTooltipContent(intFormatter);

/**
 * Token usage per experiment, stacked by prompt and completion tokens.
 */
export function ExperimentTokensChart({
  datasetId,
}: ExperimentMetricViewProps) {
  const { experiments, baselineExperiment } =
    useExperimentMetricsData(datasetId);
  const chartData = experiments.map((experiment) => ({
    sequenceNumber: experiment.sequenceNumber,
    experimentName: experiment.name,
    isBaseline: experiment.isBaseline,
    prompt: experiment.promptTokens,
    completion: experiment.completionTokens,
    total: experiment.totalTokens,
  }));
  const hasData = chartData.some((datum) => typeof datum.total === "number");

  const colors = useCategoryChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  const baselineTokens =
    baselineExperiment == null ||
    baselineExperiment.totalTokens == null ||
    (isDataKeyHidden("prompt") && isDataKeyHidden("completion"))
      ? null
      : (isDataKeyHidden("prompt")
          ? 0
          : (baselineExperiment.promptTokens ?? 0)) +
        (isDataKeyHidden("completion")
          ? 0
          : (baselineExperiment.completionTokens ?? 0));
  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasData}
      message="No token data"
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
            {...experimentMetricsYAxisProps}
            allowDecimals={false}
            tickFormatter={(x) => intShortFormatter(x)}
          />
          <Tooltip content={TooltipContent} {...defaultTooltipProps} />
          <ExperimentBaselineValueLine value={baselineTokens} />
          <Bar
            dataKey="prompt"
            stackId="a"
            fill={colors.category1}
            hide={isDataKeyHidden("prompt")}
            legendType="circle"
          />
          <Bar
            dataKey="completion"
            stackId="a"
            fill={colors.category2}
            hide={isDataKeyHidden("completion")}
            legendType="circle"
            radius={[2, 2, 0, 0]}
          />
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconSize={8}
            onToggleDataKey={toggleDataKey}
            additionalLegendItems={getExperimentBaselineLegendItems(
              baselineTokens
            )}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
