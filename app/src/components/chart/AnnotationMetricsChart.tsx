import type { ComponentProps, ReactNode } from "react";
import type {
  LegendPayload,
  TooltipContentProps,
  XAxisProps,
  YAxisProps,
} from "recharts";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useTheme } from "@phoenix/contexts";
import { getWordColor } from "@phoenix/utils/colorUtils";
import {
  floatFormatter,
  percentFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type {
  AnnotationMetricsChartPoint,
  AnnotationMetricsSeries,
  AnnotationMetricsView,
} from "./annotationMetricsUtils";
import {
  getAnnotationMetricsChartData,
  getAnnotationOtherFraction,
} from "./annotationMetricsUtils";
import { ChartEmptyStateOverlay } from "./ChartEmptyStateOverlay";
import { ChartTooltip, ChartTooltipItem } from "./ChartTooltip";
import { getCategoryChartColor, useCategoryChartColors } from "./colors";
import {
  compactChartMargin,
  compactLegendProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
} from "./defaults";
import { InteractiveLegend, useInteractiveLegend } from "./InteractiveLegend";

const MEAN_SCORE_DATA_KEY = "meanScore";
const LABEL_DATA_KEY_PREFIX = "fractions.";
const OTHER_DATA_KEY = "otherFraction";
const OTHER_COLOR = "var(--global-color-gray-500)";
// Recharts' slower line default makes mixed-view toggles feel sluggish next
// to the bar animation, so keep both chart modes on the same duration.
const SCORE_LINE_ANIMATION_DURATION_MS = 400;
const SCORE_CHART_MARGIN = {
  ...compactChartMargin,
  // A score of exactly 1 puts the dot center on the top gridline.
  top: 8,
};
const OTHER_LEGEND_ITEM: LegendPayload = {
  value: "other",
  type: "rect",
  color: OTHER_COLOR,
};
const formatAnnotationFraction = (fraction: number) =>
  percentFormatter(fraction * 100);

function getLabelDataKey(index: number): string {
  return `${LABEL_DATA_KEY_PREFIX}${index}`;
}

function AnnotationMetricsTooltip({
  active,
  payload,
  renderHeader,
}: TooltipContentProps & {
  renderHeader: (point: AnnotationMetricsChartPoint) => ReactNode;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0]?.payload as AnnotationMetricsChartPoint;
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
            shape={isMeanScore ? "line" : "square"}
            name={String(entry.name)}
            value={
              isMeanScore
                ? floatFormatter(Number(entry.value))
                : formatAnnotationFraction(Number(entry.value))
            }
          />
        );
      })}
    </ChartTooltip>
  );
}

type AnnotationMetricsChartProps = {
  series: AnnotationMetricsSeries;
  view: AnnotationMetricsView;
  xAxisProps: XAxisProps;
  yAxisProps: YAxisProps;
  syncId: string;
  renderTooltipHeader: (point: AnnotationMetricsChartPoint) => ReactNode;
  chartProps?: ComponentProps<typeof ComposedChart>;
  additionalLegendItems?: ReadonlyArray<LegendPayload>;
  emptyStateMessage?: string;
  renderReference?: (state: {
    isMeanScoreHidden: boolean;
    isReferencePrepended: boolean;
  }) => ReactNode;
};

export function AnnotationMetricsChart(props: AnnotationMetricsChartProps) {
  // Label series use positional data keys. Reset temporary legend selections
  // when that position-to-label mapping changes instead of hiding a new label.
  return (
    <AnnotationMetricsChartContent
      key={JSON.stringify(props.series.labels)}
      {...props}
    />
  );
}

function AnnotationMetricsChartContent({
  series,
  view,
  xAxisProps,
  yAxisProps,
  syncId,
  renderTooltipHeader,
  chartProps,
  additionalLegendItems,
  renderReference,
  emptyStateMessage = "No chartable evaluation data",
}: AnnotationMetricsChartProps) {
  const { theme } = useTheme();
  const categoryColors = useCategoryChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  const data = series.dataByView[view];
  const reference = series.referenceByView[view];
  const isScoreView = view === "scores";
  const scoreValues = [...data, reference].flatMap((point) =>
    point?.meanScore == null ? [] : [point.meanScore]
  );
  const scoreValuesFitUnitDomain = scoreValues.every(
    (score) => score >= 0 && score <= 1
  );
  const domain =
    !isScoreView || scoreValuesFitUnitDomain
      ? ([0, 1] as [number, number])
      : undefined;
  const visibleLabels = series.labels;
  const isReferencePrepended =
    !isScoreView &&
    reference != null &&
    !data.some(({ x }) => x === reference.x);
  // A score baseline is a non-chronological comparison value, so show it as
  // a horizontal reference without inserting it into the connected line.
  const baseChartData = isScoreView
    ? data
    : getAnnotationMetricsChartData({ data, reference });
  // Labels hidden interactively stay classified so toggling a series does not
  // change the other values.
  const chartData = isScoreView
    ? baseChartData
    : baseChartData.map((point) => ({
        ...point,
        otherFraction: getAnnotationOtherFraction({ point }),
      }));
  const hasOtherValues = chartData.some(
    (point) => "otherFraction" in point && point.otherFraction != null
  );

  return (
    <ChartEmptyStateOverlay
      isEmpty={data.length === 0}
      message={emptyStateMessage}
      chartType={isScoreView ? "line" : "bar"}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={isScoreView ? SCORE_CHART_MARGIN : compactChartMargin}
          barSize={10}
          syncId={syncId}
          // A prepended label baseline changes indexes; synchronize by x-value.
          syncMethod="value"
          {...chartProps}
        >
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis {...xAxisProps} />
          <YAxis
            {...yAxisProps}
            domain={domain}
            tickFormatter={
              isScoreView ? floatFormatter : formatAnnotationFraction
            }
          />
          <Tooltip
            {...defaultTooltipProps}
            wrapperStyle={{
              // The active ChartPanel raises this above synchronized tooltips.
              zIndex: "var(--chart-panel-tooltip-z-index, 1)",
            }}
            content={(props) => (
              <AnnotationMetricsTooltip
                {...props}
                renderHeader={renderTooltipHeader}
              />
            )}
          />
          {renderReference?.({
            isMeanScoreHidden: isDataKeyHidden(MEAN_SCORE_DATA_KEY),
            isReferencePrepended,
          })}
          {isScoreView && (
            <Line
              type="monotone"
              dataKey={MEAN_SCORE_DATA_KEY}
              name="mean score"
              stroke={getWordColor({ word: series.name, theme })}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              animationDuration={SCORE_LINE_ANIMATION_DURATION_MS}
              hide={isDataKeyHidden(MEAN_SCORE_DATA_KEY)}
            />
          )}
          {!isScoreView &&
            visibleLabels.map((label, index) => {
              const dataKey = getLabelDataKey(index);
              return (
                <Bar
                  key={label}
                  dataKey={dataKey}
                  name={label}
                  stackId="distribution"
                  fill={getCategoryChartColor({
                    index,
                    colors: categoryColors,
                  })}
                  hide={isDataKeyHidden(dataKey)}
                  radius={
                    index === visibleLabels.length - 1 && !hasOtherValues
                      ? [2, 2, 0, 0]
                      : 0
                  }
                />
              );
            })}
          {!isScoreView && hasOtherValues && (
            <Bar
              dataKey={OTHER_DATA_KEY}
              name="other"
              stackId="distribution"
              fill={OTHER_COLOR}
              legendType="none"
              radius={[2, 2, 0, 0]}
            />
          )}
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconType={isScoreView ? "line" : undefined}
            iconSize={8}
            // Preserve the normalized order so label colors remain stable by index.
            itemSorter={null}
            onToggleDataKey={toggleDataKey}
            additionalLegendItems={[
              ...(hasOtherValues ? [OTHER_LEGEND_ITEM] : []),
              ...(isScoreView && isDataKeyHidden(MEAN_SCORE_DATA_KEY)
                ? []
                : (additionalLegendItems ?? [])),
            ]}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
