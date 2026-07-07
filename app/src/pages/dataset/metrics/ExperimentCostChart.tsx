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
  InteractiveLegend,
  compactChartMargin,
  compactLegendProps,
  compactYAxisProps,
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
  getExperimentXAxisProps,
  useExperimentMetricsData,
} from "./ExperimentMetrics";
import { ExperimentMetricsTooltipHeader } from "./ExperimentMetricsTooltipHeader";
import type { ExperimentMetricViewProps } from "./types";
import { EXPERIMENT_METRICS_CHART_SYNC_ID } from "./types";

function TooltipContent({ active, payload, label }: TooltipContentProps) {
  if (active && payload && payload.length) {
    const datum = payload[0]?.payload as { experimentName?: string };
    return (
      <ChartTooltip>
        <ExperimentMetricsTooltipHeader
          sequenceNumber={Number(label)}
          name={datum?.experimentName}
        />
        {payload.map((entry) => {
          const name = String(entry.dataKey ?? entry.name ?? "unknown");
          return (
            <ChartTooltipItem
              color={entry.color ?? "transparent"}
              key={name}
              shape="circle"
              name={name}
              value={costFormatter(Number(entry.value))}
            />
          );
        })}
      </ChartTooltip>
    );
  }

  return null;
}

/**
 * Estimated cost per experiment, stacked by prompt and completion cost.
 */
export function ExperimentCostChart({ datasetId }: ExperimentMetricViewProps) {
  const { experiments } = useExperimentMetricsData(datasetId);
  const chartData = experiments.map((experiment) => ({
    sequenceNumber: experiment.sequenceNumber,
    experimentName: experiment.name,
    prompt: experiment.promptCost,
    completion: experiment.completionCost,
    total: experiment.totalCost,
  }));
  const hasData = chartData.some((datum) => typeof datum.total === "number");

  const colors = useCategoryChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
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
          <XAxis {...getExperimentXAxisProps(experiments)} />
          <YAxis
            {...compactYAxisProps}
            tickFormatter={(x) => `$${floatShortFormatter(x)}`}
          />
          <Tooltip content={TooltipContent} {...defaultTooltipProps} />
          <Bar
            dataKey="prompt"
            stackId="a"
            fill={colors.category1}
            hide={isDataKeyHidden("prompt")}
          />
          <Bar
            dataKey="completion"
            stackId="a"
            fill={colors.category2}
            hide={isDataKeyHidden("completion")}
            radius={[2, 2, 0, 0]}
          />
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconType="circle"
            iconSize={8}
            onToggleDataKey={toggleDataKey}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
