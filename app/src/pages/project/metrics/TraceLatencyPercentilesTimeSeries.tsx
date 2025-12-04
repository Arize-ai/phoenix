import { useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  LegendProps,
  Line,
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
  useBinInterval,
  useBinTimeTickFormatter,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import {
  defaultCartesianGridProps,
  defaultLegendProps,
  defaultXAxisProps,
  defaultYAxisProps,
} from "@phoenix/components/chart/defaults";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";
import { formatFloat, intFormatter } from "@phoenix/utils/numberFormatUtils";

import type { TraceLatencyPercentilesTimeSeriesQuery } from "./__generated__/TraceLatencyPercentilesTimeSeriesQuery.graphql";

function TooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const { fullTimeFormatter } = useTimeFormatters();
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
                color={entry.color || "#ffffff"}
                shape="line"
                name={entry.dataKey || "unknown"}
                value={`${formatFloat(entry.value)} s`}
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
  timeRange,
}: ProjectMetricViewProps) {
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
    timestamp: new Date(datum.timestamp),
    p50: typeof datum.p50 === "number" ? datum.p50 / 1000 : null,
    p75: typeof datum.p75 === "number" ? datum.p75 / 1000 : null,
    p90: typeof datum.p90 === "number" ? datum.p90 / 1000 : null,
    p95: typeof datum.p95 === "number" ? datum.p95 / 1000 : null,
    p99: typeof datum.p99 === "number" ? datum.p99 / 1000 : null,
    p999: typeof datum.p999 === "number" ? datum.p999 / 1000 : null,
    max: typeof datum.max === "number" ? datum.max / 1000 : null,
  }));

  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const interval = useBinInterval({ scale });

  const colors = useSequentialChartColors();

  // Legend interactivity
  const [chartState, setChartState] = useState<Record<string, boolean>>({
    p50: false,
    p75: false,
    p90: false,
    p95: false,
    p99: false,
    p999: false,
    max: false,
  });
  const selectChartItem: LegendProps["onClick"] = (e) => {
    setChartState({
      ...chartState,
      [String(e.dataKey)]: !chartState[e.dataKey as string],
    });
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData}
        margin={{ top: 0, right: 18, left: 0, bottom: 0 }}
        syncId={"projectMetrics"}
      >
        <CartesianGrid vertical={false} {...defaultCartesianGridProps} />
        <XAxis
          {...defaultXAxisProps}
          dataKey="timestamp"
          interval={interval}
          tickFormatter={(x) => timeTickFormatter(x)}
        />
        <YAxis
          width={55}
          tickFormatter={(x) => intFormatter(x)}
          label={{
            value: "Latency (s)",
            angle: -90,
            dx: -20,
            style: {
              textAnchor: "middle",
              fill: "var(--chart-axis-label-color)",
            },
          }}
          {...defaultYAxisProps}
        />
        <Line
          type="monotone"
          dataKey="p50"
          stroke={colors.blue400}
          strokeWidth={1}
          activeDot={{ r: 4 }}
          name="P50"
          hide={chartState["p50"]}
        />
        <Line
          type="monotone"
          dataKey="p75"
          stroke={colors.blue400}
          strokeWidth={1}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
          name="P75"
          hide={chartState["p75"]}
        />
        <Line
          type="monotone"
          dataKey="p90"
          stroke={colors.blue500}
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
          name="P90"
          hide={chartState["p90"]}
        />
        <Line
          type="monotone"
          dataKey="p95"
          stroke={colors.blue600}
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
          name="P95"
          hide={chartState["p95"]}
        />
        <Line
          type="monotone"
          dataKey="p99"
          stroke={colors.blue700}
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
          name="P99"
          hide={chartState["p99"]}
        />
        <Line
          type="monotone"
          dataKey="p999"
          stroke={colors.blue800}
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
          name="P99.9"
          hide={chartState["p999"]}
        />
        <Line
          type="monotone"
          dataKey="max"
          stroke={colors.blue900}
          strokeWidth={2}
          strokeDasharray={"5 5"}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
          name="Max"
          hide={chartState["max"]}
        />
        <Legend
          {...defaultLegendProps}
          iconType="line"
          iconSize={8}
          onClick={selectChartItem}
        />
        <Tooltip
          content={TooltipContent}
          cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
