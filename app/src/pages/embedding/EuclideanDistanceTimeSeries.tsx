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

import {
  Content,
  ContextualHelp,
  Heading,
  Icon,
  InfoOutline,
  Text,
  theme,
} from "@arizeai/components";

import {
  ChartTooltip,
  ChartTooltipDivider,
  ChartTooltipItem,
  colors,
  defaultSelectedTimestampReferenceLineProps,
  defaultTimeXAxisProps,
} from "@phoenix/components/chart";
import { useTimeTickFormatter } from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/contexts/TimeRangeContext";
import { useTimeSlice } from "@phoenix/contexts/TimeSliceContext";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";
import {
  calculateGranularity,
  calculateGranularityWithRollingAverage,
} from "@phoenix/utils/timeSeriesUtils";

import { EuclideanDistanceTimeSeriesQuery } from "./__generated__/EuclideanDistanceTimeSeriesQuery.graphql";

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});

const color = colors.blue400;
const barColor = colors.gray500;

const embeddingDriftContextualHelp = (
  <ContextualHelp>
    <Heading level={4}>Embedding Drift</Heading>
    <Content>
      {`Euclidean distance over time displays a timeseries graph of how much
    your primary dataset's embeddings are drifting from the reference
    data. Euclidean distance of the embeddings is calculated by taking the centroid of the embedding vectors for each dataset and calculating the distance between the two centroids.`}
    </Content>
  </ContextualHelp>
);
function TooltipContent({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
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
        <Text weight="heavy" textSize="medium">{`${fullTimeFormatter(
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
export function EuclideanDistanceTimeSeries({
  embeddingDimensionId,
}: {
  embeddingDimensionId: string;
}) {
  const { timeRange } = useTimeRange();
  const { selectedTimestamp, setSelectedTimestamp } = useTimeSlice();
  const granularity = calculateGranularity(timeRange);
  const data = useLazyLoadQuery<EuclideanDistanceTimeSeriesQuery>(
    graphql`
      query EuclideanDistanceTimeSeriesQuery(
        $embeddingDimensionId: GlobalID!
        $timeRange: TimeRange!
        $driftGranularity: Granularity!
        $countGranularity: Granularity!
      ) {
        embedding: node(id: $embeddingDimensionId) {
          id
          ... on EmbeddingDimension {
            euclideanDistanceTimeSeries: driftTimeSeries(
              metric: euclideanDistance
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
      embeddingDimensionId,
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
      driftGranularity: calculateGranularityWithRollingAverage(timeRange),
      countGranularity: granularity,
    }
  );

  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: granularity.samplingIntervalMinutes,
  });

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

  const chartRawData = data.embedding.euclideanDistanceTimeSeries?.data || [];
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
      <Heading level={3}>
        Embedding Drift
        {embeddingDriftContextualHelp}
      </Heading>
      <div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 25, right: 18, left: 18, bottom: 10 }}
            onClick={onClick}
          >
            <defs>
              <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="barColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={barColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={barColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              {...defaultTimeXAxisProps}
              tickFormatter={(x) => timeTickFormatter(new Date(x))}
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
                {...defaultSelectedTimestampReferenceLineProps}
                x={selectedTimestamp.getTime()}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
