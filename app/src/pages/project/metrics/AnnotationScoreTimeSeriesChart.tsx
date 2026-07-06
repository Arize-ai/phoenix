import { useMemo } from "react";
import type { TooltipContentProps } from "recharts";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Text } from "@phoenix/components";
import {
  ChartEmptyStateOverlay,
  ChartTooltip,
  ChartTooltipItem,
  InteractiveLegend,
  TimeRangeChartBrush,
  useBinTimeTickFormatter,
  useInteractiveLegend,
} from "@phoenix/components/chart";
import {
  defaultCartesianGridProps,
  defaultLegendProps,
  defaultTimeXAxisProps,
  defaultYAxisProps,
} from "@phoenix/components/chart/defaults";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useWordColor } from "@phoenix/hooks/useWordColor";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

export type AnnotationScoreTimeSeriesDatum = {
  readonly timestamp: string;
  readonly scoresWithLabels: ReadonlyArray<{
    readonly label: string;
    readonly score: number;
  }>;
};

function TooltipContent({ active, payload, label }: TooltipContentProps) {
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
          if (!entry.value) return null;
          return (
            <ChartTooltipItem
              key={index}
              color={entry.color || "#FF00FF"} // hot pink, fail loudly.
              shape="line"
              name={String(entry.dataKey || "unknown")}
              value={Number(entry.value).toFixed(2)}
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
}: {
  data: ReadonlyArray<AnnotationScoreTimeSeriesDatum>;
  names: ReadonlyArray<string>;
  scale: TimeBinScale;
  timeRange: TimeRange;
  onTimeRangeSelected?: (timeRange: TimeRange) => void;
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
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 0, right: 18, left: 8, bottom: 0 }}
              syncId={"projectMetrics"}
              {...chartProps}
            >
              <XAxis
                {...defaultTimeXAxisProps}
                domain={[timeRange.start.getTime(), timeRange.end.getTime()]}
                tickFormatter={(x) => timeTickFormatter(new Date(x))}
              />
              <YAxis
                width={55}
                tickFormatter={(x) => formatFloat(x)}
                label={{
                  value: "Score",
                  angle: -90,
                  dx: -28,
                  style: {
                    textAnchor: "middle",
                    fill: "var(--chart-axis-label-color)",
                  },
                }}
                {...defaultYAxisProps}
              />
              <CartesianGrid vertical={false} {...defaultCartesianGridProps} />
              <Tooltip
                content={TooltipContent}
                cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
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
                {...defaultLegendProps}
                hiddenDataKeys={hiddenDataKeys}
                iconType="line"
                iconSize={8}
                onToggleDataKey={toggleDataKey}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartEmptyStateOverlay>
      )}
    </TimeRangeChartBrush>
  );
}
