import { theme } from "@arizeai/components";
import React from "react";
import { timeFormat } from "d3-time-format";
import { useLazyLoadQuery } from "react-relay";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import { graphql } from "relay-runtime";
import { EuclideanDistanceTimeSeriesQuery } from "./__generated__/EuclideanDistanceTimeSeriesQuery.graphql";
import { css } from "@emotion/react";

const timeFormatter = timeFormat("%x");
function TooltipContent({ active, payload, label }: TooltipProps<any, any>) {
  if (active && payload && payload.length) {
    return (
      <div
        css={(theme) => css`
          background-color: ${theme.colors.gray700};
          border: 1px solid transparent;
          padding: ${theme.spacing.margin4}px;
        `}
      >
        <p>{`${timeFormatter(new Date(label))}`}</p>
        <p>{`${payload[0].value}`}</p>
      </div>
    );
  }

  return null;
}
export function EuclideanDistanceTimeSeries({
  embeddingDimensionId,
  timeRange,
}: {
  embeddingDimensionId: string;
  timeRange: TimeRange;
}) {
  const data = useLazyLoadQuery<EuclideanDistanceTimeSeriesQuery>(
    graphql`
      query EuclideanDistanceTimeSeriesQuery(
        $embeddingDimensionId: GlobalID!
        $timeRange: TimeRange!
      ) {
        embedding: node(id: $embeddingDimensionId) {
          id
          ... on EmbeddingDimension {
            euclideanDistanceTimeSeries: driftTimeSeries(
              metric: euclideanDistance
              timeRange: $timeRange
            ) {
              data {
                timestamp
                value
              }
            }
            trafficTimeSeries: dataQualityTimeSeries(
              m
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
    }
  );
  const chartData = data.embedding.euclideanDistanceTimeSeries?.data;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={chartData as unknown as any[]}
        margin={{ top: 20, right: 50, left: 30, bottom: 10 }}
      >
        <defs>
          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ffffff" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="timestamp"
          stroke={theme.colors.gray200}
          // TODO: Fix this to be a cleaner interface
          tickFormatter={(x) => timeFormatter(new Date(x))}
        />
        <YAxis
          stroke={theme.colors.gray200}
          label={{
            value: "Euc. Distance",
            angle: -90,
            position: "insideLeft",
            style: { textAnchor: "middle" },
          }}
        />
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={theme.colors.gray200}
          strokeOpacity={0.3}
        />
        <Tooltip content={<TooltipContent />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#ffffff"
          fillOpacity={1}
          fill="url(#colorUv)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
