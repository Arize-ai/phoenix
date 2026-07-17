import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import type {
  LegendPayload,
  TooltipContentProps,
  XAxisProps,
  YAxisProps,
} from "recharts";
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
  floatFormatter,
  percentFormatter,
} from "@phoenix/utils/numberFormatUtils";

import { ChartEmptyStateOverlay } from "./ChartEmptyStateOverlay";
import { ChartTooltip, ChartTooltipItem } from "./ChartTooltip";
import { getCategoryChartColor, useCategoryChartColors } from "./colors";
import {
  compactChartMargin,
  compactLegendProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
} from "./defaults";
import type {
  EvaluationMetricsChartPoint,
  EvaluationMetricsSeries,
  EvaluationMetricsView,
} from "./evaluationMetricsUtils";
import { getEvaluationMetricsChartData } from "./evaluationMetricsUtils";
import {
  InteractiveLegend,
  type InteractiveLegendDataKey,
} from "./InteractiveLegend";

const MEAN_SCORE_DATA_KEY = "meanScore";
const MEAN_SCORE_LEGEND_ITEM_ID = "score:mean";
const LABEL_DATA_KEY_PREFIX = "fractions.";
const LABEL_LEGEND_ITEM_PREFIX = "label:";
export const formatEvaluationFraction = (fraction: number) =>
  percentFormatter(fraction * 100);

function getLabelDataKey(index: number): string {
  return `${LABEL_DATA_KEY_PREFIX}${index}`;
}

export function getEvaluationLegendItemId({
  dataKey,
  visibleLabels,
}: {
  dataKey: InteractiveLegendDataKey;
  visibleLabels: ReadonlyArray<string>;
}): string | null {
  if (dataKey === MEAN_SCORE_DATA_KEY) {
    return MEAN_SCORE_LEGEND_ITEM_ID;
  }
  if (
    typeof dataKey !== "string" ||
    !dataKey.startsWith(LABEL_DATA_KEY_PREFIX)
  ) {
    return null;
  }
  const index = Number(dataKey.slice(LABEL_DATA_KEY_PREFIX.length));
  const label = visibleLabels[index];
  return label == null ? null : `${LABEL_LEGEND_ITEM_PREFIX}${label}`;
}

export function getEvaluationHiddenDataKeys({
  hiddenLegendItemIds,
  visibleLabels,
}: {
  hiddenLegendItemIds: ReadonlySet<string>;
  visibleLabels: ReadonlyArray<string>;
}): ReadonlySet<InteractiveLegendDataKey> {
  const hiddenDataKeys = new Set<InteractiveLegendDataKey>();
  if (hiddenLegendItemIds.has(MEAN_SCORE_LEGEND_ITEM_ID)) {
    hiddenDataKeys.add(MEAN_SCORE_DATA_KEY);
  }
  visibleLabels.forEach((label, index) => {
    if (hiddenLegendItemIds.has(`${LABEL_LEGEND_ITEM_PREFIX}${label}`)) {
      hiddenDataKeys.add(getLabelDataKey(index));
    }
  });
  return hiddenDataKeys;
}

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
    </ChartTooltip>
  );
}

export function EvaluationMetricsChart({
  series,
  view,
  xAxisProps,
  yAxisProps,
  syncId,
  renderTooltipHeader,
  barChartProps,
  additionalLegendItems,
  renderReference,
  labelCount = series.labels.length,
  legendTrailingContent,
}: {
  series: EvaluationMetricsSeries;
  view: EvaluationMetricsView;
  xAxisProps: XAxisProps;
  yAxisProps: YAxisProps;
  syncId: string;
  renderTooltipHeader: (point: EvaluationMetricsChartPoint) => ReactNode;
  barChartProps?: ComponentProps<typeof BarChart>;
  additionalLegendItems?: ReadonlyArray<LegendPayload>;
  renderReference?: (state: { isMeanScoreHidden: boolean }) => ReactNode;
  labelCount?: number;
  legendTrailingContent?: ReactNode;
}) {
  const categoryColors = useCategoryChartColors();
  // Recharts keys are positional (`fractions.0`, etc.), so retain semantic
  // label identities to avoid hiding a different label after labels reorder.
  const [hiddenLegendItemIds, setHiddenLegendItemIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
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
  const chartData = getEvaluationMetricsChartData({ data, reference });
  const visibleLabels = series.labels.slice(0, labelCount);
  const isDataKeyHidden = (dataKey: InteractiveLegendDataKey) => {
    const legendItemId = getEvaluationLegendItemId({ dataKey, visibleLabels });
    return legendItemId != null && hiddenLegendItemIds.has(legendItemId);
  };
  const hiddenDataKeys = getEvaluationHiddenDataKeys({
    hiddenLegendItemIds,
    visibleLabels,
  });
  const toggleDataKey = (dataKey: InteractiveLegendDataKey) => {
    const legendItemId = getEvaluationLegendItemId({ dataKey, visibleLabels });
    if (legendItemId == null) {
      return;
    }
    setHiddenLegendItemIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(legendItemId)) {
        nextIds.delete(legendItemId);
      } else {
        nextIds.add(legendItemId);
      }
      return nextIds;
    });
  };

  return (
    <ChartEmptyStateOverlay
      isEmpty={data.length === 0}
      message="No evaluation data"
      chartType="bar"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={compactChartMargin}
          barSize={10}
          syncId={syncId}
          // A prepended baseline changes array indexes; synchronize by x-value.
          syncMethod="value"
          {...barChartProps}
        >
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis {...xAxisProps} />
          <YAxis
            {...yAxisProps}
            domain={domain}
            tickFormatter={
              isScoreView ? floatFormatter : formatEvaluationFraction
            }
          />
          <Tooltip
            {...defaultTooltipProps}
            wrapperStyle={{
              // The active ChartPanel raises this above synchronized tooltips.
              zIndex: "var(--chart-panel-tooltip-z-index, 1)",
            }}
            content={(props) => (
              <EvaluationMetricsTooltip
                {...props}
                renderHeader={renderTooltipHeader}
              />
            )}
          />
          {renderReference?.({
            isMeanScoreHidden: isDataKeyHidden(MEAN_SCORE_DATA_KEY),
          })}
          {isScoreView && (
            <Bar
              dataKey={MEAN_SCORE_DATA_KEY}
              name="Mean score"
              fill={getCategoryChartColor({ index: 0, colors: categoryColors })}
              hide={isDataKeyHidden(MEAN_SCORE_DATA_KEY)}
              radius={[2, 2, 0, 0]}
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
                  radius={index === visibleLabels.length - 1 ? [2, 2, 0, 0] : 0}
                />
              );
            })}
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconSize={8}
            // The server orders labels by baseline/latest frequency; preserve
            // that ranking instead of Recharts' default alphabetical sort.
            itemSorter={null}
            onToggleDataKey={toggleDataKey}
            additionalLegendItems={
              isScoreView && isDataKeyHidden(MEAN_SCORE_DATA_KEY)
                ? []
                : additionalLegendItems
            }
            trailingContent={legendTrailingContent}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
