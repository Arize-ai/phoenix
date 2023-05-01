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
import { css } from "@emotion/react";

import { Heading, Icon, InfoOutline, Text, theme } from "@arizeai/components";

import {
  ChartTooltip,
  ChartTooltipDivider,
  ChartTooltipItem,
  fullTimeFormatter,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/contexts/TimeRangeContext";
import { useTimeSlice } from "@phoenix/contexts/TimeSliceContext";
import {
  calculateGranularity,
  calculateGranularityWithRollingAverage,
} from "@phoenix/utils/timeSeriesUtils";

import { DimensionDriftTimeSeriesQuery } from "./__generated__/DimensionDriftTimeSeriesQuery.graphql";

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
          name="PSI"
          value={euclideanDistanceString}
        />
        <ChartTooltipItem
          color={barColor}
          shape="square"
          name="Count"
          value={predictionCountString}
        />
        <ChartTooltipDivider />
        <div
          css={css`
            display: flex;
            flex-direction: row;
            align-items: center;
            color: var(--px-light-blue-color);
            gap: var(--px-spacing-sm);

            margin-top: var(--px-spacing-sm);
          `}
        >
          <Icon svg={<InfoOutline />} />
          <span>Click to view the distribution at this time</span>
        </div>
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
  const { selectedTimestamp, setSelectedTimestamp } = useTimeSlice();
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
      countGranularity: calculateGranularity(timeRange),
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

  let chartData = data.embedding.driftTimeSeries?.data || [];
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
    <section
      css={css`
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        h3 {
          padding: var(--px-spacing-sm) var(--px-spacing-lg) 0
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
      <Heading level={3}>Dimension Drift</Heading>
      <div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData as unknown as any[]}
            margin={{ top: 25, right: 18, left: 18, bottom: 10 }}
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
              <>
                <ReferenceLine
                  x={selectedTimestamp.toISOString()}
                  stroke="white"
                  label={{
                    value: "▼",
                    position: "top",
                    style: {
                      fill: "#fabe32",
                      fontSize: theme.typography.sizes.small.fontSize,
                    },
                  }}
                />
              </>
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
