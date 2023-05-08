import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { css } from "@emotion/react";

import { Heading, Text, theme } from "@arizeai/components";

import {
  ChartTooltip,
  ChartTooltipDivider,
  ChartTooltipItem,
  colors,
  fullTimeFormatter,
  shortTimeFormatter,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/contexts/TimeRangeContext";
import { calculateGranularity } from "@phoenix/utils/timeSeriesUtils";

import { DimensionCardinalityTimeSeriesQuery } from "./__generated__/DimensionCardinalityTimeSeriesQuery.graphql";

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});

const color = colors.purple300;

function TooltipContent({ active, payload, label }: TooltipProps<any, any>) {
  if (active && payload && payload.length) {
    const cardinality = payload[1]?.value ?? null;
    const cardinalityString =
      typeof cardinality === "number"
        ? numberFormatter.format(cardinality)
        : "--";

    return (
      <ChartTooltip>
        <Text weight="heavy" textSize="large">{`${fullTimeFormatter(
          new Date(label)
        )}`}</Text>
        <ChartTooltipItem
          color={color}
          name="cardinality"
          value={cardinalityString}
        />
        <ChartTooltipDivider />
      </ChartTooltip>
    );
  }

  return null;
}
export function DimensionCardinalityTimeSeries({
  dimensionId,
}: {
  dimensionId: string;
}) {
  const { timeRange } = useTimeRange();
  const data = useLazyLoadQuery<DimensionCardinalityTimeSeriesQuery>(
    graphql`
      query DimensionCardinalityTimeSeriesQuery(
        $dimensionId: GlobalID!
        $timeRange: TimeRange!
        $granularity: Granularity!
      ) {
        embedding: node(id: $dimensionId) {
          id
          ... on Dimension {
            cardinalityTimeSeries: dataQualityTimeSeries(
              metric: cardinality
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
      granularity: calculateGranularity(timeRange),
    }
  );

  const chartData =
    data.embedding.cardinalityTimeSeries?.data.map((d) => {
      return {
        timestamp: new Date(d.timestamp).valueOf(),
        cardinality: d.value,
      };
    }) || [];

  return (
    <section
      css={css`
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        h3 {
          padding: var(--px-spacing-lg) var(--px-spacing-lg) 0
            var(--px-spacing-lg);
          flex: none;
          .ac-action-button {
            margin-left: var(--px-spacing-sm);
          }
        }
        & > div {
          flex: 1 1 auto;
          width: 100%;
          overflow: hidden;
        }
      `}
    >
      <Heading level={3}>Cardinality</Heading>
      <div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData as unknown as any[]}
            margin={{ top: 25, right: 18, left: 18, bottom: 10 }}
            syncId={"dimensionDetails"}
          >
            <defs>
              <linearGradient
                id="cardinalityColorUv"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="timestamp"
              stroke={theme.colors.gray200}
              // TODO: Fix this to be a cleaner interface
              tickFormatter={(x) => shortTimeFormatter(new Date(x))}
              style={{ fill: theme.textColors.white70 }}
              scale="time"
              type="number"
              domain={["auto", "auto"]}
              padding={{ left: 10, right: 10 }}
            />
            <YAxis
              stroke={theme.colors.gray200}
              label={{
                value: "Cardinality",
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
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fillOpacity={1}
              fill="url(#cardinalityColorUv)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
