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
  costFormatter,
  floatShortFormatter,
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

const TooltipContent = makeExperimentMetricsTooltipContent(costFormatter);

/**
 * Estimated cost per experiment, stacked by prompt and completion cost.
 */
export function ExperimentCostChart({ datasetId }: ExperimentMetricViewProps) {
  const { experiments, baselineExperiment } =
    useExperimentMetricsData(datasetId);
  const chartData = experiments.map((experiment) => ({
    sequenceNumber: experiment.sequenceNumber,
    experimentName: experiment.name,
    isBaseline: experiment.isBaseline,
    prompt: experiment.promptCost,
    completion: experiment.completionCost,
    total: experiment.totalCost,
  }));
  const hasData = chartData.some((datum) => typeof datum.total === "number");

  const colors = useCategoryChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  const baselineCost =
    baselineExperiment == null ||
    baselineExperiment.totalCost == null ||
    (isDataKeyHidden("prompt") && isDataKeyHidden("completion"))
      ? null
      : (isDataKeyHidden("prompt") ? 0 : (baselineExperiment.promptCost ?? 0)) +
        (isDataKeyHidden("completion")
          ? 0
          : (baselineExperiment.completionCost ?? 0));
  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasData}
      message="No cost data"
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
            tickFormatter={(x) => `$${floatShortFormatter(x)}`}
          />
          <Tooltip content={TooltipContent} {...defaultTooltipProps} />
          <ExperimentBaselineValueLine value={baselineCost} />
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
              baselineCost
            )}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
