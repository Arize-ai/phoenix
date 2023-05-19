import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";

import { Text, theme } from "@arizeai/components";

import {
  ChartTooltip,
  ChartTooltipItem,
  fullTimeFormatter,
  useTimeTickFormatter,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/contexts/TimeRangeContext";
import { calculateGranularity } from "@phoenix/utils/timeSeriesUtils";

import { DimensionPercentEmptyTimeSeriesQuery } from "./__generated__/DimensionPercentEmptyTimeSeriesQuery.graphql";
import { timeSeriesChartMargins } from "./dimensionChartConstants";

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});

const color = "#aaaaaa";

function TooltipContent({ active, payload, label }: TooltipProps<any, any>) {
  if (active && payload && payload.length) {
    const percentEmpty = payload[0]?.value ?? null;
    const percentEmptyString =
      typeof percentEmpty === "number"
        ? numberFormatter.format(percentEmpty)
        : "--";
    return (
      <ChartTooltip>
        <Text weight="heavy" textSize="medium">{`${fullTimeFormatter(
          new Date(label)
        )}`}</Text>
        <ChartTooltipItem
          color={color}
          name="% Empty"
          value={percentEmptyString}
        />
      </ChartTooltip>
    );
  }

  return null;
}

export function DimensionPercentEmptyTimeSeries({
  dimensionId,
}: {
  dimensionId: string;
}) {
  const { timeRange } = useTimeRange();
  const granularity = calculateGranularity(timeRange);
  const data = useLazyLoadQuery<DimensionPercentEmptyTimeSeriesQuery>(
    graphql`
      query DimensionPercentEmptyTimeSeriesQuery(
        $dimensionId: GlobalID!
        $timeRange: TimeRange!
        $granularity: Granularity!
      ) {
        embedding: node(id: $dimensionId) {
          id
          ... on Dimension {
            percentEmptyTimeSeries: dataQualityTimeSeries(
              metric: percentEmpty
              timeRange: $timeRange
              granularity: $granularity
            ) {
              data {
                timestamp
                value
              }
            }
          }
        }
      }
    `,
    {
      dimensionId,
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
      granularity,
    }
  );

  const chartData =
    data.embedding.percentEmptyTimeSeries?.data.map((d) => ({
      timestamp: new Date(d.timestamp).valueOf(),
      value: d.value,
    })) || [];

  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: granularity.samplingIntervalMinutes,
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData as unknown as any[]}
        margin={timeSeriesChartMargins}
        syncId={"dimensionDetails"}
      >
        <defs>
          <linearGradient id="percentEmptyColorUv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.8} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="timestamp"
          stroke={theme.colors.gray200}
          tickFormatter={(x) => timeTickFormatter(new Date(x))}
          style={{ fill: theme.textColors.white70 }}
          scale="time"
          type="number"
          domain={["auto", "auto"]}
          padding={{ left: 10, right: 10 }}
        />
        <YAxis
          stroke={theme.colors.gray200}
          label={{
            value: "% Empty",
            angle: -90,
            position: "insideLeft",
            style: { textAnchor: "middle", fill: theme.textColors.white90 },
          }}
          style={{ fill: theme.textColors.white70 }}
        />
        <CartesianGrid
          strokeDasharray="4 4"
          stroke={theme.colors.gray200}
          strokeOpacity={0.5}
        />
        <Tooltip content={<TooltipContent />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          fillOpacity={1}
          fill="url(#percentEmptyColorUv)"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
