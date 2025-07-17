import { graphql, useLazyLoadQuery } from "react-relay";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";

import { Text } from "@phoenix/components";
import {
  ChartTooltip,
  ChartTooltipItem,
  defaultBarChartTooltipProps,
  defaultTimeXAxisProps,
  useChartColors,
  useTimeTickFormatter,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/contexts/TimeRangeContext";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";
import { calculateGranularity } from "@phoenix/utils/timeSeriesUtils";

import { DimensionCountTimeSeriesQuery } from "./__generated__/DimensionCountTimeSeriesQuery.graphql";
import { timeSeriesChartMargins } from "./dimensionChartConstants";

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});

const useColors = () => {
  const { gray300 } = useChartColors();
  return {
    barColor: gray300,
  };
};

function TooltipContent({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  const { barColor } = useColors();
  if (active && payload && payload.length) {
    const count = payload[0]?.value ?? null;
    const predictionCountString =
      typeof count === "number" ? numberFormatter.format(count) : "--";
    return (
      <ChartTooltip>
        <Text weight="heavy" size="S">{`${fullTimeFormatter(
          new Date(label)
        )}`}</Text>
        <ChartTooltipItem
          color={barColor}
          shape="square"
          name="Count"
          value={predictionCountString}
        />
      </ChartTooltip>
    );
  }

  return null;
}
export function DimensionCountTimeSeries({
  dimensionId,
}: {
  dimensionId: string;
}) {
  const { timeRange } = useTimeRange();
  const countGranularity = calculateGranularity(timeRange);
  const data = useLazyLoadQuery<DimensionCountTimeSeriesQuery>(
    graphql`
      query DimensionCountTimeSeriesQuery(
        $dimensionId: ID!
        $timeRange: TimeRange!
        $countGranularity: Granularity!
      ) {
        embedding: node(id: $dimensionId) {
          id
          ... on Dimension {
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
      countGranularity,
    }
  );

  const chartRawData = data.embedding.trafficTimeSeries?.data || [];

  const chartData = chartRawData.map((d) => {
    return {
      ...d,
      timestamp: new Date(d.timestamp).valueOf(),
    };
  });

  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: countGranularity.samplingIntervalMinutes,
  });
  const { barColor } = useColors();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={timeSeriesChartMargins}
        syncId={"dimensionDetails"}
      >
        <defs>
          <linearGradient id="countBarColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={barColor} stopOpacity={1} />
            <stop offset="95%" stopColor={barColor} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <XAxis
          {...defaultTimeXAxisProps}
          tickFormatter={(x) => timeTickFormatter(new Date(x))}
        />
        <YAxis
          stroke="var(--ac-global-color-grey-500)"
          label={{
            value: "Count",
            angle: -90,
            position: "insideLeft",
            style: {
              textAnchor: "middle",
              fill: "var(--ac-global-text-color-900)",
            },
          }}
          style={{ fill: "var(--ac-global-text-color-700)" }}
        />
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="var(--ac-global-color-grey-500)"
          strokeOpacity={0.5}
        />
        <Tooltip
          {...defaultBarChartTooltipProps}
          content={<TooltipContent />}
        />
        <Bar dataKey="value" fill="url(#countBarColor)" spacing={5} />
      </BarChart>
    </ResponsiveContainer>
  );
}
