import React, { useCallback } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
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

import { Icon, InfoOutline, Text, theme } from "@arizeai/components";

import {
  ChartTooltip,
  ChartTooltipDivider,
  ChartTooltipItem,
  defaultSelectedTimestampReferenceLineProps,
  defaultTimeXAxisProps,
  fullTimeFormatter,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/contexts/TimeRangeContext";
import { useTimeSlice } from "@phoenix/contexts/TimeSliceContext";
import { calculateGranularity } from "@phoenix/utils/timeSeriesUtils";

import { CountTimeSeriesQuery } from "./__generated__/CountTimeSeriesQuery.graphql";

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});

const barColor = "#93b3c841";

function TooltipContent({ active, payload, label }: TooltipProps<any, any>) {
  if (active && payload && payload.length) {
    const count = payload[0]?.value ?? null;
    const predictionCountString =
      typeof count === "number" ? numberFormatter.format(count) : "--";
    return (
      <ChartTooltip>
        <Text weight="heavy" textSize="large">{`${fullTimeFormatter(
          new Date(label)
        )}`}</Text>
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
          <span>Click to view the point cloud at this time</span>
        </div>
      </ChartTooltip>
    );
  }

  return null;
}
export function CountTimeSeries({
  embeddingDimensionId,
}: {
  embeddingDimensionId: string;
}) {
  const { timeRange } = useTimeRange();
  const { selectedTimestamp, setSelectedTimestamp } = useTimeSlice();
  const data = useLazyLoadQuery<CountTimeSeriesQuery>(
    graphql`
      query CountTimeSeriesQuery(
        $embeddingDimensionId: GlobalID!
        $timeRange: TimeRange!
        $countGranularity: Granularity!
      ) {
        embedding: node(id: $embeddingDimensionId) {
          id
          ... on EmbeddingDimension {
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
      embeddingDimensionId,
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
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

  const chartRawData = data.embedding.trafficTimeSeries?.data || [];
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
      timestamp: new Date(d.timestamp).getTime(),
    };
  });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData as unknown as any[]}
        margin={{ top: 25, right: 80, left: 18, bottom: 10 }}
        onClick={onClick}
      >
        <defs>
          <linearGradient id="barColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={barColor} stopOpacity={0.9} />
            <stop offset="95%" stopColor={barColor} stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <XAxis
          {...defaultTimeXAxisProps}
          // TODO: Fix this to be a cleaner interface
          tickFormatter={(x) => fullTimeFormatter(new Date(x))}
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
        <Bar dataKey="value" fill="url(#barColor)" spacing={5} />
        {selectedTimestamp != null ? (
          <ReferenceLine
            {...defaultSelectedTimestampReferenceLineProps}
            x={selectedTimestamp.getTime()}
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
