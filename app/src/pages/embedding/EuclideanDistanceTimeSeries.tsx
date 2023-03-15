import React, { useCallback } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { CategoricalChartFunc } from "recharts/types/chart/generateCategoricalChart";

import { Text, theme } from "@arizeai/components";

import {
  ChartTooltip,
  ChartTooltipDivider,
  ChartTooltipItem,
  fullTimeFormatter,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/contexts/TimeRangeContext";
import { useTimeSlice } from "@phoenix/contexts/TimeSliceContext";

import { EuclideanDistanceTimeSeriesQuery } from "./__generated__/EuclideanDistanceTimeSeriesQuery.graphql";

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});

const color = "#5899C5";
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
          name="Euc. Distance"
          value={euclideanDistanceString}
        />
        <ChartTooltipItem
          color={barColor}
          shape="square"
          name="Count"
          value={predictionCountString}
        />
        <ChartTooltipDivider />
        <Text>Click to view drift at this time</Text>
      </ChartTooltip>
    );
  }

  return null;
}
export function EuclideanDistanceTimeSeries({
  embeddingDimensionId,
}: {
  embeddingDimensionId: string;
}) {
  const { timeRange } = useTimeRange();
  const { selectedTimestamp, setSelectedTimestamp } = useTimeSlice();
  const data = useLazyLoadQuery<EuclideanDistanceTimeSeriesQuery>(
    graphql`
      query EuclideanDistanceTimeSeriesQuery(
        $embeddingDimensionId: GlobalID!
        $timeRange: TimeRange!
        $granularity: Granularity!
      ) {
        embedding: node(id: $embeddingDimensionId) {
          id
          ... on EmbeddingDimension {
            euclideanDistanceTimeSeries: driftTimeSeries(
              metric: euclideanDistance
              timeRange: $timeRange
              granularity: $granularity
            ) {
              data {
                timestamp
                value
              }
            }
            trafficTimeSeries: dataQualityTimeSeries(
              metric: count
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
      embeddingDimensionId,
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
      granularity: {
        evaluationWindowMinutes: 4320,
        samplingIntervalMinutes: 60 * 24,
      },
    }
  );

  const onClick: CategoricalChartFunc = useCallback(
    (state) => {
      // Parse out the timestamp from the first chart
      const { activePayload } = state;
      if (activePayload != null && activePayload.length > 0) {
        const payload = activePayload[0].payload;
        setSelectedTimestamp(new Date(payload.timestamp));
      }
    },
    [setSelectedTimestamp]
  );

  let chartData = data.embedding.euclideanDistanceTimeSeries?.data || [];
  const trafficDataMap =
    data.embedding.trafficTimeSeries?.data.reduce((acc, traffic) => {
      acc[traffic.timestamp] = traffic.value;
      return acc;
    }, {} as Record<string, number | null>) ?? {};

  chartData = chartData.map((d) => {
    const traffic = trafficDataMap[d.timestamp];
    return {
      ...d,
      traffic: traffic,
      timestamp: new Date(d.timestamp).toISOString(),
    };
  });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData as unknown as any[]}
        margin={{ top: 20, right: 18, left: 18, bottom: 10 }}
        onClick={onClick}
      >
        <defs>
          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
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
          tickFormatter={(x) => fullTimeFormatter(new Date(x))}
          style={{ fill: theme.textColors.white70 }}
        />
        <YAxis
          stroke={theme.colors.gray200}
          label={{
            value: "Euc. Distance",
            angle: -90,
            position: "insideLeft",
            style: { textAnchor: "middle", fill: theme.textColors.white90 },
          }}
          style={{ fill: theme.textColors.white70 }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          label={{
            value: "Count",
            angle: 90,
            position: "insideRight",
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
          fill="url(#colorUv)"
        />

        {selectedTimestamp != null ? (
          <ReferenceLine
            x={selectedTimestamp.toISOString()}
            stroke="white"
            // label={{
            //   value: "Selection",
            //   position: "insideTopRight",
            //   style: { fill: theme.textColors.white90 },
            // }}
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
