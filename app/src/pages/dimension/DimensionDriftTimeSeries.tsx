import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
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
  fullTimeFormatter,
  useTimeTickFormatter,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/contexts/TimeRangeContext";
import {
  calculateGranularity,
  calculateGranularityWithRollingAverage,
} from "@phoenix/utils/timeSeriesUtils";

import { DimensionDriftTimeSeriesQuery } from "./__generated__/DimensionDriftTimeSeriesQuery.graphql";
import { timeSeriesChartMargins } from "./dimensionChartConstants";

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});

const color = colors.orange300;
const barColor = "#93b3c841";

function TooltipContent({ active, payload, label }: TooltipProps<any, any>) {
  if (active && payload && payload.length) {
    const euclideanDistance = payload[1]?.value ?? null;
    const count = payload[0]?.value ?? null;
    const euclideanDistanceString =
      typeof euclideanDistance === "number"
        ? numberFormatter.format(euclideanDistance)
        : "--";
    const predictionCountString =
      typeof count === "number" ? numberFormatter.format(count) : "--";
    return (
      <ChartTooltip>
        <Text weight="heavy" textSize="large">{`${fullTimeFormatter(
          new Date(label)
        )}`}</Text>
        <ChartTooltipItem
          color={color}
          name="PSI"
          value={euclideanDistanceString}
        />
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
export function DimensionDriftTimeSeries({
  dimensionId,
}: {
  dimensionId: string;
}) {
  const { timeRange } = useTimeRange();
  const countGranularity = calculateGranularity(timeRange);
  const data = useLazyLoadQuery<DimensionDriftTimeSeriesQuery>(
    graphql`
      query DimensionDriftTimeSeriesQuery(
        $dimensionId: GlobalID!
        $timeRange: TimeRange!
        $driftGranularity: Granularity!
        $countGranularity: Granularity!
      ) {
        embedding: node(id: $dimensionId) {
          id
          ... on Dimension {
            driftTimeSeries: driftTimeSeries(
              metric: psi
              timeRange: $timeRange
              granularity: $driftGranularity
            ) {
              data {
                timestamp
                value
              }
            }
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
      driftGranularity: calculateGranularityWithRollingAverage(timeRange),
      countGranularity,
    }
  );

  const chartRawData = data.embedding.driftTimeSeries?.data || [];
  const trafficDataMap =
    data.embedding.trafficTimeSeries?.data.reduce((acc, traffic) => {
      acc[traffic.timestamp] = traffic.value;
      return acc;
    }, {} as Record<string, number | null>) ?? {};

  const chartData = chartRawData.map((d) => {
    const traffic = trafficDataMap[d.timestamp];
    return {
      ...d,
      traffic: traffic,
      timestamp: new Date(d.timestamp).valueOf(),
    };
  });

  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: countGranularity.samplingIntervalMinutes,
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData as unknown as any[]}
        margin={timeSeriesChartMargins}
        // onClick={onClick}
        syncId={"dimensionDetails"}
      >
        <defs>
          <linearGradient
            id="dimensionDriftColorUv"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="5%" stopColor={color} stopOpacity={0.8} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="barColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={barColor} stopOpacity={0.8} />
            <stop offset="95%" stopColor={barColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="timestamp"
          stroke={theme.colors.gray200}
          // TODO: Fix this to be a cleaner interface
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
            value: "PSI",
            angle: -90,
            position: "insideLeft",
            style: { textAnchor: "middle", fill: theme.textColors.white90 },
          }}
          style={{ fill: theme.textColors.white70 }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={false}
          tickLine={false}
          width={0}
        />
        <CartesianGrid
          strokeDasharray="4 4"
          stroke={theme.colors.gray200}
          strokeOpacity={0.5}
        />
        <Tooltip content={<TooltipContent />} />
        <Bar
          yAxisId="right"
          dataKey="traffic"
          fill="url(#barColor)"
          spacing={5}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          fillOpacity={1}
          fill="url(#dimensionDriftColorUv)"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
