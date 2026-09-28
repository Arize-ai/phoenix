import { Fragment, type ComponentProps, type ReactNode } from "react";
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
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Text } from "@phoenix/components";
import { AnnotationScoreText } from "@phoenix/components/annotation";
import { useTheme } from "@phoenix/contexts";
import { getWordColor } from "@phoenix/utils/colorUtils";
import {
  floatFormatter,
  percentFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type {
  AnnotationMetricsChartPoint,
  AnnotationMetricsGroupedRow,
  AnnotationMetricsSeries,
  AnnotationMetricsView,
} from "./annotationMetricsUtils";
import {
  getAnnotationMetricsChartData,
  getAnnotationOtherFraction,
  mergeAnnotationMetricsSeries,
} from "./annotationMetricsUtils";
import { ChartEmptyStateOverlay } from "./ChartEmptyStateOverlay";
import { ChartResponsiveContainer } from "./ChartResponsiveContainer";
import { ChartTooltip, ChartTooltipItem } from "./ChartTooltip";
import {
  getCategoryChartColor,
  useCategoryChartColors,
  useSemanticChartColors,
} from "./colors";
import {
  COMPACT_CHART_ANIMATION_DURATION_MS,
  compactChartMargin,
  compactLegendProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  stackedBarSeparatorProps,
} from "./defaults";
import { InteractiveLegend, useInteractiveLegend } from "./InteractiveLegend";

const MEAN_SCORE_DATA_KEY = "meanScore";
const LABEL_DATA_KEY_PREFIX = "fractions.";
const OTHER_DATA_KEY = "otherFraction";
const OTHER_COLOR = "var(--global-color-gray-500)";
const MEAN_SCORE_SERIES_NAME = "mean score";
const DISTRIBUTION_STACK_ID = "distribution";
const BAR_SIZE = 10;
// Only the topmost segment of a stack is rounded, so the stack reads as one bar.
const STACK_TOP_RADIUS: [number, number, number, number] = [2, 2, 0, 0];
const SQUARE_RADIUS = 0;
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
  getMeanScoreOptimization,
}: TooltipContentProps & {
  renderHeader: (point: AnnotationMetricsChartPoint) => ReactNode;
  getMeanScoreOptimization?: (meanScore: number) => boolean | null;
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
        const numericValue = Number(entry.value);
        const formattedValue = isMeanScore
          ? floatFormatter(numericValue)
          : formatAnnotationFraction(numericValue);
        return (
          <ChartTooltipItem
            key={String(entry.dataKey)}
            color={entry.color}
            shape={isMeanScore ? "line" : "square"}
            name={String(entry.name)}
            value={
              isMeanScore && getMeanScoreOptimization ? (
                <AnnotationScoreText
                  positiveOptimization={getMeanScoreOptimization(numericValue)}
                >
                  {formattedValue}
                </AnnotationScoreText>
              ) : (
                formattedValue
              )
            }
          />
        );
      })}
    </ChartTooltip>
  );
}

/** One label's slice of a stacked label-share bar, bottom to top. */
export type AnnotationLabelSegment = {
  readonly label: string;
  /** Position of the label in its series' labels and fractions. */
  readonly index: number;
  readonly color: string;
};

/**
 * One stacked bar of label shares per bin, bottom segment first, capped by
 * the unlabeled share when there is one. Only the topmost segment is rounded
 * so the stack reads as one bar. Returned as an array because Recharts reads
 * its series from the chart's direct children.
 */
function renderLabelShareBars({
  segments,
  stackId,
  dataKeyPrefix = "",
  hasOtherValues,
  isDataKeyHidden,
}: {
  segments: ReadonlyArray<AnnotationLabelSegment>;
  stackId: string;
  /** Path to the series' point within a chart row, e.g. "values.a." */
  dataKeyPrefix?: string;
  hasOtherValues: boolean;
  isDataKeyHidden?: (dataKey: string) => boolean;
}): ReactNode[] {
  const bars = segments.map((segment, position) => {
    const dataKey = getLabelDataKey(segment.index);
    return (
      <Bar
        key={`${dataKeyPrefix}${dataKey}`}
        dataKey={`${dataKeyPrefix}${dataKey}`}
        name={segment.label}
        stackId={stackId}
        {...stackedBarSeparatorProps}
        fill={segment.color}
        hide={isDataKeyHidden?.(dataKey)}
        radius={
          position === segments.length - 1 && !hasOtherValues
            ? STACK_TOP_RADIUS
            : SQUARE_RADIUS
        }
      />
    );
  });
  if (hasOtherValues) {
    bars.push(
      <Bar
        key={`${dataKeyPrefix}${OTHER_DATA_KEY}`}
        dataKey={`${dataKeyPrefix}${OTHER_DATA_KEY}`}
        name="other"
        stackId={stackId}
        {...stackedBarSeparatorProps}
        fill={OTHER_COLOR}
        legendType="none"
        radius={STACK_TOP_RADIUS}
      />
    );
  }
  return bars;
}

type AnnotationMetricsChartProps = {
  series: AnnotationMetricsSeries;
  view: AnnotationMetricsView;
  xAxisProps: XAxisProps;
  yAxisProps: YAxisProps;
  syncId: string;
  renderTooltipHeader: (point: AnnotationMetricsChartPoint) => ReactNode;
  getMeanScoreOptimization?: (meanScore: number) => boolean | null;
  /**
   * Classifies the series' labels as good versus bad, one flag per label in
   * `series.labels` order, to color a two-label distribution green and red.
   * Pass null (or omit) to keep the categorical palette;
   * `getBinaryLabelOptimizations` computes this and returns null whenever the
   * labels carry no such meaning.
   */
  labelOptimizations?: ReadonlyArray<boolean> | null;
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

function getAnnotationChartState({
  series,
  view,
}: Pick<AnnotationMetricsChartProps, "series" | "view">) {
  const { data, reference } = series;
  const isScoreView = view === "scores";
  const scoreValues = [...data, reference].flatMap((point) =>
    point?.meanScore == null ? [] : [point.meanScore]
  );
  const domain =
    !isScoreView || scoreValues.every((score) => score >= 0 && score <= 1)
      ? ([0, 1] as [number, number])
      : undefined;
  const isReferencePrepended =
    !isScoreView &&
    reference != null &&
    !data.some(({ x }) => x === reference.x);
  const baseChartData = isScoreView
    ? data
    : getAnnotationMetricsChartData({ data, reference });
  const chartData = isScoreView
    ? baseChartData
    : baseChartData.map((point) => ({
        ...point,
        otherFraction: getAnnotationOtherFraction({ point }),
      }));
  return {
    chartData,
    domain,
    hasOtherValues: chartData.some(
      (point) => "otherFraction" in point && point.otherFraction != null
    ),
    isReferencePrepended,
    isScoreView,
  };
}

function AnnotationMetricsChartContent({
  series,
  view,
  xAxisProps,
  yAxisProps,
  syncId,
  renderTooltipHeader,
  getMeanScoreOptimization,
  labelOptimizations,
  chartProps,
  additionalLegendItems,
  renderReference,
  emptyStateMessage = "No chartable evaluation data",
}: AnnotationMetricsChartProps) {
  const { theme } = useTheme();
  const categoryColors = useCategoryChartColors();
  // A good label reads the same green as an optimized score does elsewhere.
  const semanticColors = useSemanticChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  const { data, labels } = series;
  const {
    chartData,
    domain,
    hasOtherValues,
    isReferencePrepended,
    isScoreView,
  } = getAnnotationChartState({ series, view });
  // Null means "no good-versus-bad reading": stay on the categorical palette.
  const appliedLabelOptimizations =
    (isScoreView ? null : labelOptimizations) ?? null;
  const getLabelFill = (index: number) =>
    appliedLabelOptimizations
      ? appliedLabelOptimizations[index]
        ? semanticColors.success
        : semanticColors.danger
      : getCategoryChartColor({ index, colors: categoryColors });

  return (
    <ChartEmptyStateOverlay
      isEmpty={data.length === 0}
      message={emptyStateMessage}
      chartType={isScoreView ? "line" : "bar"}
    >
      <ChartResponsiveContainer>
        <ComposedChart
          data={chartData}
          margin={isScoreView ? SCORE_CHART_MARGIN : compactChartMargin}
          barSize={BAR_SIZE}
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
                getMeanScoreOptimization={getMeanScoreOptimization}
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
              name={MEAN_SCORE_SERIES_NAME}
              stroke={getWordColor({ word: series.name, theme })}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              animationDuration={COMPACT_CHART_ANIMATION_DURATION_MS}
              hide={isDataKeyHidden(MEAN_SCORE_DATA_KEY)}
            />
          )}
          {!isScoreView &&
            renderLabelShareBars({
              segments: labels.map((label, index) => ({
                label,
                index,
                color: getLabelFill(index),
              })),
              stackId: DISTRIBUTION_STACK_ID,
              hasOtherValues,
              isDataKeyHidden,
            })}
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
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}

/** One series drawn by {@link AnnotationMetricsGroupedChart}. */
export type AnnotationMetricsChartGroup = {
  /** Identifies the group in chart rows, stacks, and axes. */
  readonly key: string;
  readonly name: string;
  /** The mean score line color. */
  readonly color: string;
  readonly series: AnnotationMetricsSeries | undefined;
  /** Label slices in stacking order, bottom first. */
  readonly segments: ReadonlyArray<AnnotationLabelSegment>;
  /** The group's own score axis in the scores view, e.g. its domain. */
  readonly scoreAxisProps?: YAxisProps;
  readonly getMeanScoreOptimization?: (meanScore: number) => boolean | null;
};

type AnnotationMetricsGroupedChartProps = {
  groups: ReadonlyArray<AnnotationMetricsChartGroup>;
  view: AnnotationMetricsView;
  xAxisProps: XAxisProps;
  yAxisProps: YAxisProps;
  renderTooltipHeader: (x: number) => ReactNode;
  chartProps?: ComponentProps<typeof ComposedChart>;
  emptyStateMessage?: string;
};

function getGroupDataKeyPrefix(key: string) {
  return `values.${key}.`;
}

/**
 * Several annotation series over one x axis: mean scores as lines on their
 * own axes (the first on the left, the rest on the right), or label shares as
 * side-by-side stacked bars per bin. The multi-series counterpart of
 * {@link AnnotationMetricsChart}, drawn with the same bars and lines.
 */
export function AnnotationMetricsGroupedChart({
  groups,
  view,
  xAxisProps,
  yAxisProps,
  renderTooltipHeader,
  chartProps,
  emptyStateMessage = "No chartable evaluation data",
}: AnnotationMetricsGroupedChartProps) {
  const isScoreView = view === "scores";
  const visibleGroups = groups.filter((group) =>
    group.series?.views.includes(view)
  );
  const rows = mergeAnnotationMetricsSeries(
    Object.fromEntries(visibleGroups.map((group) => [group.key, group.series]))
  );
  return (
    <ChartEmptyStateOverlay
      isEmpty={visibleGroups.length === 0}
      message={emptyStateMessage}
      chartType={isScoreView ? "line" : "bar"}
    >
      <ChartResponsiveContainer>
        <ComposedChart
          data={rows}
          margin={isScoreView ? SCORE_CHART_MARGIN : compactChartMargin}
          barSize={BAR_SIZE}
          barGap={1}
          {...chartProps}
        >
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis {...xAxisProps} />
          {isScoreView ? (
            groups.map((group, index) => (
              <YAxis
                key={group.key}
                {...yAxisProps}
                yAxisId={group.key}
                orientation={index === 0 ? "left" : "right"}
                hide={!visibleGroups.includes(group)}
                tickFormatter={floatFormatter}
                {...group.scoreAxisProps}
              />
            ))
          ) : (
            <YAxis
              {...yAxisProps}
              domain={[0, 1]}
              tickFormatter={formatAnnotationFraction}
            />
          )}
          <Tooltip
            {...defaultTooltipProps}
            content={(props) => (
              <AnnotationMetricsGroupedTooltip
                {...props}
                view={view}
                groups={visibleGroups}
                renderHeader={renderTooltipHeader}
              />
            )}
          />
          {isScoreView
            ? visibleGroups.map((group) => (
                <Line
                  key={group.key}
                  yAxisId={group.key}
                  type="monotone"
                  dataKey={`${getGroupDataKeyPrefix(group.key)}${MEAN_SCORE_DATA_KEY}`}
                  name={group.name}
                  stroke={group.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: group.color }}
                  activeDot={{ r: 5 }}
                  // Bins without results would otherwise strand sparse
                  // means as lone dots.
                  connectNulls
                  animationDuration={COMPACT_CHART_ANIMATION_DURATION_MS}
                />
              ))
            : visibleGroups.flatMap((group) =>
                renderLabelShareBars({
                  segments: group.segments,
                  stackId: group.key,
                  dataKeyPrefix: getGroupDataKeyPrefix(group.key),
                  hasOtherValues: rows.some(
                    (row) => row.values[group.key]?.otherFraction != null
                  ),
                })
              )}
        </ComposedChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}

function AnnotationMetricsGroupedTooltip({
  active,
  payload,
  view,
  groups,
  renderHeader,
}: TooltipContentProps & {
  view: AnnotationMetricsView;
  groups: ReadonlyArray<AnnotationMetricsChartGroup>;
  renderHeader: (x: number) => ReactNode;
}) {
  const row = payload?.[0]?.payload as AnnotationMetricsGroupedRow | undefined;
  if (!active || !row) {
    return null;
  }
  return (
    <ChartTooltip>
      {renderHeader(row.x)}
      {groups.map((group) => {
        const value = row.values[group.key];
        if (view === "scores") {
          return (
            <ChartTooltipItem
              key={group.key}
              color={group.color}
              shape="line"
              name={group.name}
              value={
                value?.meanScore == null ? (
                  "--"
                ) : group.getMeanScoreOptimization ? (
                  <AnnotationScoreText
                    positiveOptimization={group.getMeanScoreOptimization(
                      value.meanScore
                    )}
                  >
                    {floatFormatter(value.meanScore)}
                  </AnnotationScoreText>
                ) : (
                  floatFormatter(value.meanScore)
                )
              }
            />
          );
        }
        return (
          <Fragment key={group.key}>
            <Text size="XS" weight="heavy">
              {group.name}
            </Text>
            {value == null ? (
              <Text size="XS" color="text-700">
                No results
              </Text>
            ) : (
              <>
                {group.segments.map((segment) => {
                  const fraction = value.fractions[segment.index];
                  return fraction == null ? null : (
                    <ChartTooltipItem
                      key={segment.index}
                      color={segment.color}
                      shape="square"
                      name={segment.label}
                      value={formatAnnotationFraction(fraction)}
                    />
                  );
                })}
                {value.otherFraction != null ? (
                  <ChartTooltipItem
                    color={OTHER_COLOR}
                    shape="square"
                    name="other"
                    value={formatAnnotationFraction(value.otherFraction)}
                  />
                ) : null}
              </>
            )}
          </Fragment>
        );
      })}
    </ChartTooltip>
  );
}
