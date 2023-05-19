import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
  colors,
  useTimeTickFormatter,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/contexts/TimeRangeContext";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";
import { calculateGranularity } from "@phoenix/utils/timeSeriesUtils";

import { DimensionCountTimeSeriesQuery } from "./__generated__/DimensionCountTimeSeriesQuery.graphql";
import { timeSeriesChartMargins } from "./dimensionChartConstants";

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});

const barColor = colors.gray300;

function TooltipContent({ active, payload, label }: TooltipProps<any, any>) {
  if (active && payload && payload.length) {
    const count = payload[0]?.value ?? null;
    const predictionCountString =
      typeof count === "number" ? numberFormatter.format(count) : "--";
    return (
      <ChartTooltip>
        <Text weight="heavy" textSize="medium">{`${fullTimeFormatter(
          new Date(label)
        )}`}</Text>
        <ChartTooltipItem
          color={barColor}
          shape="square"
          name="Count"
          value={predictionCountString}
        />
      </ChartTooltip>
    );
  }

  return null;
}
export function DimensionCountTimeSeries({
  dimensionId,
}: {
  dimensionId: string;
}) {
  const { timeRange } = useTimeRange();
  const countGranularity = calculateGranularity(timeRange);
  const data = useLazyLoadQuery<DimensionCountTimeSeriesQuery>(
    graphql`
      query DimensionCountTimeSeriesQuery(
        $dimensionId: GlobalID!
        $timeRange: TimeRange!
        $countGranularity: Granularity!
      ) {
        embedding: node(id: $dimensionId) {
          id
          ... on Dimension {
            trafficTimeSeries: dataQualityTimeSeries(
              metric: count
              timeRange: $timeRange
              granularity: $countGranularity
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
      countGranularity,
    }
  );

  const chartRawData = data.embedding.trafficTimeSeries?.data || [];

  const chartData = chartRawData.map((d) => {
    return {
      ...d,
      timestamp: new Date(d.timestamp).valueOf(),
    };
  });

  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: countGranularity.samplingIntervalMinutes,
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData as unknown as any[]}
        margin={timeSeriesChartMargins}
        syncId={"dimensionDetails"}
      >
        <defs>
          <linearGradient id="countBarColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={barColor} stopOpacity={1} />
            <stop offset="95%" stopColor={barColor} stopOpacity={0.5} />
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
            value: "Count",
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
        <Bar dataKey="value" fill="url(#countBarColor)" spacing={5} />
      </BarChart>
    </ResponsiveContainer>
  );
}
