import React, { useCallback } from "react";
import { useLazyLoadQuery } from "react-relay";
import { timeFormat } from "d3-time-format";
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
import { graphql } from "relay-runtime";
import { css } from "@emotion/react";

import { theme } from "@arizeai/components";

import { useTimeRange } from "@phoenix/contexts/TimeRangeContext";
import { useTimeSlice } from "@phoenix/contexts/TimeSliceContext";

import { EuclideanDistanceTimeSeriesQuery } from "./__generated__/EuclideanDistanceTimeSeriesQuery.graphql";

const timeFormatter = timeFormat("%x");

function TooltipContent({ active, payload, label }: TooltipProps<any, any>) {
  if (active && payload && payload.length) {
    return (
      <div
        css={(theme) => css`
          background-color: ${theme.colors.gray700};
          border: 1px solid transparent;
          padding: ${theme.spacing.margin4}px;
          border-radius: ${theme.rounding.rounding4}px;
        `}
      >
        <p>{`${timeFormatter(new Date(label))}`}</p>
        <p>{`${payload[0].value}`}</p>
        <p>Click to view drift at this time</p>
      </div>
    );
  }

  return null;
}
export function EuclideanDistanceTimeSeries({
  embeddingDimensionId,
  color = "#5899C5",
  barColor = "#93b3c841",
}: {
  embeddingDimensionId: string;
  color?: string;
  barColor?: string;
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
  const chartTrafficData = data.embedding.trafficTimeSeries?.data || [];
  chartData = chartData.map((d) => {
    const traffic = chartTrafficData.find(
      (traffic) => traffic.timestamp === d.timestamp
    );
    return {
      ...d,
      traffic: traffic?.value,
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
          tickFormatter={(x) => timeFormatter(new Date(x))}
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
