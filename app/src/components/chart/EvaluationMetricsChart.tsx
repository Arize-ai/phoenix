import type { ComponentProps, ReactNode } from "react";
import type { TooltipContentProps, XAxisProps, YAxisProps } from "recharts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useTheme } from "@phoenix/contexts";
import { getWordColor } from "@phoenix/utils/colorUtils";
import {
  floatFormatter,
  intFormatter,
  percentFormatter,
} from "@phoenix/utils/numberFormatUtils";

import { ChartEmptyStateOverlay } from "./ChartEmptyStateOverlay";
import {
  ChartTooltip,
  ChartTooltipDivider,
  ChartTooltipItem,
} from "./ChartTooltip";
import {
  getCategoryChartColor,
  useCategoryChartColors,
  useSequentialChartColors,
} from "./colors";
import {
  compactChartMargin,
  compactLegendProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
} from "./defaults";
import type {
  EvaluationMetricsChartPoint,
  EvaluationMetricsSeries,
} from "./evaluationMetricsUtils";
import { SCORE_ONLY_LABEL } from "./evaluationMetricsUtils";
import { InteractiveLegend, useInteractiveLegend } from "./InteractiveLegend";

const MEAN_SCORE_DATA_KEY = "meanScore";
export const formatEvaluationFraction = (fraction: number) =>
  percentFormatter(fraction * 100);

function EvaluationMetricsTooltip({
  active,
  payload,
  renderHeader,
}: TooltipContentProps & {
  renderHeader: (point: EvaluationMetricsChartPoint) => ReactNode;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0]?.payload as EvaluationMetricsChartPoint;
  return (
    <ChartTooltip>
      {renderHeader(point)}
      {payload.map((entry) => {
        if (entry.value == null) {
          return null;
        }
        const isMeanScore = entry.dataKey === MEAN_SCORE_DATA_KEY;
        return (
          <ChartTooltipItem
            key={String(entry.dataKey)}
            color={entry.color}
            shape="square"
            name={String(entry.name)}
            value={
              isMeanScore
                ? floatFormatter(Number(entry.value))
                : formatEvaluationFraction(Number(entry.value))
            }
          />
        );
      })}
      <ChartTooltipDivider />
      <ChartTooltipItem name="Count" value={intFormatter(point.count)} />
      <ChartTooltipItem name="Scores" value={intFormatter(point.scoreCount)} />
      <ChartTooltipItem name="Labels" value={intFormatter(point.labelCount)} />
    </ChartTooltip>
  );
}

export function EvaluationMetricsChart({
  series,
  xAxisProps,
  yAxisProps,
  syncId,
  renderTooltipHeader,
  barChartProps,
}: {
  series: EvaluationMetricsSeries;
  xAxisProps: XAxisProps;
  yAxisProps: YAxisProps;
  syncId: string;
  renderTooltipHeader: (point: EvaluationMetricsChartPoint) => ReactNode;
  barChartProps?: ComponentProps<typeof BarChart>;
}) {
  const { theme } = useTheme();
  const categoryColors = useCategoryChartColors();
  const { gray500 } = useSequentialChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  const scoreValues = series.data.flatMap(({ meanScore }) =>
    meanScore == null ? [] : [meanScore]
  );
  const scoreValuesFitUnitDomain = scoreValues.every(
    (score) => score >= 0 && score <= 1
  );
  const domain =
    !series.hasScores || scoreValuesFitUnitDomain
      ? ([0, 1] as [number, number])
      : undefined;

  return (
    <ChartEmptyStateOverlay
      isEmpty={!series.hasScores && !series.hasLabels}
      message="No evaluation data"
      chartType="bar"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={series.data}
          margin={compactChartMargin}
          barSize={10}
          syncId={syncId}
          {...barChartProps}
        >
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis {...xAxisProps} />
          <YAxis
            {...yAxisProps}
            domain={domain}
            tickFormatter={
              series.hasScores ? floatFormatter : formatEvaluationFraction
            }
          />
          <Tooltip
            {...defaultTooltipProps}
            content={(props) => (
              <EvaluationMetricsTooltip
                {...props}
                renderHeader={renderTooltipHeader}
              />
            )}
          />
          {series.hasScores && (
            <Bar
              dataKey={MEAN_SCORE_DATA_KEY}
              name="Mean score"
              fill={getCategoryChartColor({ index: 0, colors: categoryColors })}
              hide={isDataKeyHidden(MEAN_SCORE_DATA_KEY)}
              radius={[2, 2, 0, 0]}
            />
          )}
          {series.hasLabels &&
            series.labels.map((label, index) => {
              const dataKey = `fractions.${index}`;
              return (
                <Bar
                  key={label}
                  dataKey={dataKey}
                  name={label}
                  stackId="distribution"
                  fill={
                    label === SCORE_ONLY_LABEL
                      ? gray500
                      : getWordColor({ word: label, theme })
                  }
                  hide={isDataKeyHidden(dataKey)}
                  radius={index === series.labels.length - 1 ? [2, 2, 0, 0] : 0}
                />
              );
            })}
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconSize={8}
            onToggleDataKey={toggleDataKey}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
