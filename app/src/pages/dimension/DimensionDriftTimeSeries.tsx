import { useCallback } from "react";
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

import { Icon, Icons, Text } from "@phoenix/components";
import {
  ChartTooltip,
  ChartTooltipDivider,
  ChartTooltipItem,
  defaultSelectedTimestampReferenceLineProps,
  defaultTimeXAxisProps,
  useChartColors,
  useTimeTickFormatter,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/contexts/TimeRangeContext";
import { useTimeSlice } from "@phoenix/contexts/TimeSliceContext";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";
import {
  calculateGranularity,
  calculateGranularityWithRollingAverage,
} from "@phoenix/utils/timeSeriesUtils";

import { DimensionDriftTimeSeriesQuery } from "./__generated__/DimensionDriftTimeSeriesQuery.graphql";
import { timeSeriesChartMargins } from "./dimensionChartConstants";
const useColors = () => {
  const { orange300, gray300 } = useChartColors();
  return {
    color: orange300,
    barColor: gray300,
  };
};

function TooltipContent({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  const { color } = useColors();
  if (active && payload && payload.length) {
    const euclideanDistance = payload[1]?.value ?? null;

    return (
      <ChartTooltip>
        <Text weight="heavy" size="S">{`${fullTimeFormatter(
          new Date(label)
        )}`}</Text>
        <ChartTooltipItem
          color={color}
          name="PSI"
          value={floatFormatter(euclideanDistance)}
        />
        <ChartTooltipDivider />
        <div
          css={css`
            display: flex;
            flex-direction: row;
            align-items: center;
            color: var(--ac-global-color-primary);
            gap: var(--ac-global-dimension-static-size-50);

            margin-top: var(--ac-global-dimension-static-size-50);
          `}
        >
          <Icon svg={<Icons.InfoOutline />} />
          <span>Click to view details</span>
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
  const countGranularity = calculateGranularity(timeRange);
  const data = useLazyLoadQuery<DimensionDriftTimeSeriesQuery>(
    graphql`
      query DimensionDriftTimeSeriesQuery(
        $dimensionId: ID!
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
    data.embedding.trafficTimeSeries?.data.reduce(
      (acc, traffic) => {
        acc[traffic.timestamp] = traffic.value;
        return acc;
      },
      {} as Record<string, number | null>
    ) ?? {};

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

  const { color, barColor } = useColors();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData}
        margin={timeSeriesChartMargins}
        onClick={onClick}
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
          {...defaultTimeXAxisProps}
          tickFormatter={(x) => timeTickFormatter(new Date(x))}
        />
        <YAxis
          stroke="var(--ac-global-color-grey-500)"
          label={{
            value: "PSI",
            angle: -90,
            position: "insideLeft",
            style: {
              textAnchor: "middle",
              fill: "var(--ac-global-text-color-900)",
            },
          }}
          style={{ fill: "var(--ac-global-color-grey-500)" }}
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
          stroke="var(--ac-global-color-grey-500)"
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
