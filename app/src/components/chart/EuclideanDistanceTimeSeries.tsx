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
} from "recharts";
import { graphql } from "relay-runtime";
import { EuclideanDistanceTimeSeriesQuery } from "./__generated__/EuclideanDistanceTimeSeriesQuery.graphql";

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
            driftTimeSeries(metric: euclideanDistance, timeRange: $timeRange) {
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
    }
  );
  const chartData = data.embedding.driftTimeSeries?.data;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={chartData as unknown as any[]}
        margin={{ top: 20, right: 50, left: 0, bottom: 10 }}
      >
        <defs>
          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="timestamp"
          stroke={theme.colors.gray200}
          // TODO: Fix this to be a cleaner interface
          tickFormatter={(x) => timeFormat("%x")(new Date(x))}
        />
        <YAxis stroke={theme.colors.gray200} />
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={theme.colors.gray200}
          strokeOpacity={0.3}
        />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#8884d8"
          fillOpacity={1}
          fill="url(#colorUv)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
