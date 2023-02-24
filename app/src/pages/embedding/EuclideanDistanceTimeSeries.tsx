import { theme } from "@arizeai/components";
import React from "react";
import { timeFormat } from "d3-time-format";
import { useLazyLoadQuery } from "react-relay";
import {
  Area,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  TooltipProps,
  ComposedChart,
} from "recharts";
import { graphql } from "relay-runtime";
import { EuclideanDistanceTimeSeriesQuery } from "./__generated__/EuclideanDistanceTimeSeriesQuery.graphql";
import { css } from "@emotion/react";
import { useTimeRange } from "../../contexts/TimeRangeContext";

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
}: {
  embeddingDimensionId: string;
}) {
  const { timeRange } = useTimeRange();
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
      <ComposedChart
        data={chartData as unknown as any[]}
        margin={{ top: 20, right: 18, left: 18, bottom: 10 }}
      >
        <defs>
          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#9E98C8" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#9E98C8" stopOpacity={0} />
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
            value: "Traffic",
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
        <Area
          type="monotone"
          dataKey="value"
          stroke="#9E98C8"
          fillOpacity={1}
          fill="url(#colorUv)"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
