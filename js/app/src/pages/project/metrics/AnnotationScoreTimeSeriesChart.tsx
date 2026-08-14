import { useMemo } from "react";
import type { TooltipContentProps } from "recharts";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Text } from "@phoenix/components";
import {
  AnnotationScoreText,
  type AnnotationOptimizationConfig,
  getPositiveOptimizationFromConfig,
} from "@phoenix/components/annotation";
import {
  ChartEmptyStateOverlay,
  ChartResponsiveContainer,
  ChartTooltip,
  ChartTooltipItem,
  compactChartMargin,
  compactLegendProps,
  compactTimeXAxisProps,
  compactYAxisProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  InteractiveLegend,
  TimeRangeChartBrush,
  useBinTimeTickFormatter,
  useInteractiveLegend,
} from "@phoenix/components/chart";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useWordColor } from "@phoenix/hooks/useWordColor";
import { PROJECT_METRICS_CHART_SYNC_ID } from "@phoenix/pages/project/metrics/types";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

export type AnnotationScoreTimeSeriesDatum = {
  readonly timestamp: string;
  readonly scoresWithLabels: ReadonlyArray<{
    readonly label: string;
    readonly score: number;
  }>;
};

function TooltipContent({
  active,
  payload,
  label,
  annotationConfigsByName,
}: TooltipContentProps & {
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
}) {
  const { fullTimeFormatter } = useTimeFormatters();
  if (active && payload && payload.length) {
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(Number(label))
          )}`}</Text>
        )}
        {payload.map((entry, index) => {
          if (entry.value == null) return null;
          const annotationName = String(entry.dataKey || "unknown");
          const score = Number(entry.value);
          return (
            <ChartTooltipItem
              key={index}
              color={entry.color}
              shape="line"
              name={annotationName}
              value={
                <AnnotationScoreText
                  positiveOptimization={getPositiveOptimizationFromConfig({
                    config: annotationConfigsByName.get(annotationName),
                    score,
                  })}
                >
                  {score.toFixed(2)}
                </AnnotationScoreText>
              }
            />
          );
        })}
      </ChartTooltip>
    );
  }

  return null;
}

function AnnotationLine({
  isHidden,
  name,
}: {
  isHidden: boolean;
  name: string;
}) {
  const color = useWordColor(name);
  return (
    <Line
      type="monotone"
      dataKey={name}
      stroke={color}
      strokeWidth={2}
      dot={{ r: 2 }}
      activeDot={{ r: 4 }}
      hide={isHidden}
      name={name}
    />
  );
}

export function AnnotationScoreTimeSeriesChart({
  data,
  names,
  scale,
  timeRange,
  onTimeRangeSelected,
  annotationConfigsByName,
}: {
  data: ReadonlyArray<AnnotationScoreTimeSeriesDatum>;
  names: ReadonlyArray<string>;
  scale: TimeBinScale;
  timeRange: TimeRange;
  onTimeRangeSelected?: (timeRange: TimeRange) => void;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
}) {
  // Transform the data to have one property per annotation label
  const chartData = useMemo(
    () =>
      data.map((datum) => {
        const transformed: Record<string, string | number> = {
          timestamp: new Date(datum.timestamp).getTime(),
        };

        datum.scoresWithLabels.forEach((scoreWithLabel) => {
          transformed[scoreWithLabel.label] = scoreWithLabel.score;
        });

        return transformed;
      }),
    [data]
  );

  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const hasData = names.length > 0;
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();

  return (
    <TimeRangeChartBrush onTimeRangeSelected={onTimeRangeSelected}>
      {({ chartProps }) => (
        <ChartEmptyStateOverlay
          isEmpty={!hasData}
          message="No data in this time range"
          chartType="line"
        >
          <ChartResponsiveContainer>
            <LineChart
              data={chartData}
              margin={compactChartMargin}
              syncId={PROJECT_METRICS_CHART_SYNC_ID}
              {...chartProps}
            >
              <XAxis
                {...compactTimeXAxisProps}
                domain={[timeRange.start.getTime(), timeRange.end.getTime()]}
                tickFormatter={(x) => timeTickFormatter(new Date(x))}
              />
              <YAxis
                {...compactYAxisProps}
                tickFormatter={(x) => formatFloat(x)}
              />
              <CartesianGrid {...defaultCartesianGridProps} />
              <Tooltip
                content={(props) => (
                  <TooltipContent
                    {...props}
                    annotationConfigsByName={annotationConfigsByName}
                  />
                )}
                {...defaultTooltipProps}
              />

              {names.map((name) => {
                return (
                  <AnnotationLine
                    isHidden={isDataKeyHidden(name)}
                    key={name}
                    name={name}
                  />
                );
              })}

              <InteractiveLegend
                {...compactLegendProps}
                hiddenDataKeys={hiddenDataKeys}
                iconType="line"
                iconSize={8}
                onToggleDataKey={toggleDataKey}
              />
            </LineChart>
          </ChartResponsiveContainer>
        </ChartEmptyStateOverlay>
      )}
    </TimeRangeChartBrush>
  );
}
