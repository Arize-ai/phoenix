import { graphql, useLazyLoadQuery } from "react-relay";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";

import { Text } from "@phoenix/components";
import {
  ChartTooltip,
  ChartTooltipItem,
  useChartColors,
  useTimeTickFormatter,
} from "@phoenix/components/chart";
import {
  defaultCartesianGridProps,
  defaultXAxisProps,
  defaultYAxisProps,
} from "@phoenix/components/chart/defaults";
import { useTimeRange } from "@phoenix/components/datetime";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

import type { TraceLatencyPercentilesTimeSeriesQuery } from "./__generated__/TraceLatencyPercentilesTimeSeriesQuery.graphql";

function TooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const chartColors = useChartColors();
  if (active && payload && payload.length) {
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(label)
          )}`}</Text>
        )}
        {payload.map(
          (
            entry: { value?: number; color?: string; dataKey?: string },
            index: number
          ) => {
            if (!entry.value) return null;
            return (
              <ChartTooltipItem
                key={index}
                color={entry.color || chartColors.default}
                shape="line"
                name={entry.dataKey || "unknown"}
                value={`${intFormatter(entry.value)}ms`} // TODO: format times in a more readable way
              />
            );
          }
        )}
      </ChartTooltip>
    );
  }

  return null;
}

export function TraceLatencyPercentilesTimeSeries({
  projectId,
}: {
  projectId: string;
}) {
  const { timeRange } = useTimeRange();
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<TraceLatencyPercentilesTimeSeriesQuery>(
    graphql`
      query TraceLatencyPercentilesTimeSeriesQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            traceLatencyMsPercentileTimeSeries(
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) {
              data {
                timestamp
                p50
                p75
                p90
                p95
                p99
                p999
                max
              }
            }
          }
        }
      }
    `,
    {
      projectId,
      timeRange: {
        start: timeRange.start?.toISOString(),
        end: timeRange.end?.toISOString(),
      },
      timeBinConfig: {
        scale,
        utcOffsetMinutes,
      },
    }
  );

  const chartData = (
    data.project.traceLatencyMsPercentileTimeSeries?.data ?? []
  ).map((datum) => ({
    timestamp: datum.timestamp,
    p50: datum.p50,
    p75: datum.p75,
    p90: datum.p90,
    p95: datum.p95,
    p99: datum.p99,
    p999: datum.p999,
    max: datum.max,
  }));

  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: (() => {
      switch (scale) {
        case "MINUTE":
          return 1;
        case "HOUR":
          return 60;
        default:
          return 60 * 24;
      }
    })(),
  });

  const colors = useChartColors();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{ top: 0, right: 18, left: 0, bottom: 0 }}
      >
        <XAxis
          dataKey="timestamp"
          tickFormatter={(x) => timeTickFormatter(new Date(x))}
          {...defaultXAxisProps}
        />
        <YAxis
          width={50}
          label={{
            value: "Latency (ms)",
            angle: -90,
            dx: -10,
            style: {
              textAnchor: "middle",
              fill: "var(--chart-axis-label-color)",
            },
          }}
          {...defaultYAxisProps}
        />

        <CartesianGrid vertical={false} {...defaultCartesianGridProps} />
        <Tooltip
          content={TooltipContent}
          cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
        />

        <Line
          type="monotone"
          dataKey="p50"
          stroke={colors.blue400}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          name="P50"
        />
        <Line
          type="monotone"
          dataKey="p75"
          stroke={colors.orange400}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          name="P75"
        />
        <Line
          type="monotone"
          dataKey="p90"
          stroke={colors.orange400}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          name="P90"
        />
        <Line
          type="monotone"
          dataKey="p95"
          stroke={colors.red400}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          name="P95"
        />
        <Line
          type="monotone"
          dataKey="p99"
          stroke={colors.purple400}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          name="P99"
        />
        <Line
          type="monotone"
          dataKey="p999"
          stroke={colors.gray600}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          name="P99.9"
        />
        <Line
          type="monotone"
          dataKey="max"
          stroke={colors.gray700}
          strokeWidth={1}
          strokeDasharray="5 5"
          dot={false}
          activeDot={{ r: 4 }}
          name="Max"
        />

        <Legend align="left" iconType="line" iconSize={8} />
      </LineChart>
    </ResponsiveContainer>
  );
}
