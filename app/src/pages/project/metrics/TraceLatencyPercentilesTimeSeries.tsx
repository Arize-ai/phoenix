import { graphql, useLazyLoadQuery } from "react-relay";
import type { TooltipContentProps } from "recharts";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Text } from "@phoenix/components";
import {
  ChartEmptyStateOverlay,
  ChartTooltip,
  ChartTooltipItem,
  compactChartMargin,
  compactLegendProps,
  compactTimeXAxisProps,
  compactYAxisProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  InteractiveLegend,
  TimeRangeChartBrush,
  useBinTimeTickFormatter,
  useInteractiveLegend,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import type { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";
import {
  PROJECT_METRICS_CHART_SYNC_ID,
  useMetricQueryFetchOptions,
} from "@phoenix/pages/project/metrics/types";
import {
  formatFloat,
  latencyMsFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type { TraceLatencyPercentilesTimeSeriesQuery } from "./__generated__/TraceLatencyPercentilesTimeSeriesQuery.graphql";

function TooltipContent({ active, payload, label }: TooltipContentProps) {
  const { fullTimeFormatter } = useTimeFormatters();
  if (active && payload && payload.length) {
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(Number(label))
          )}`}</Text>
        )}
        {payload.map((entry, index) => {
          if (entry.value == null) return null;
          return (
            <ChartTooltipItem
              key={index}
              color={entry.color}
              shape="line"
              name={String(entry.dataKey || "unknown")}
              value={`${formatFloat(Number(entry.value))} s`}
            />
          );
        })}
      </ChartTooltip>
    );
  }

  return null;
}

export function TraceLatencyPercentilesTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
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
    },
    useMetricQueryFetchOptions()
  );

  const chartData = (
    data.project.traceLatencyMsPercentileTimeSeries?.data ?? []
  ).map((datum) => ({
    timestamp: new Date(datum.timestamp).getTime(),
    p50: typeof datum.p50 === "number" ? datum.p50 / 1000 : null,
    p75: typeof datum.p75 === "number" ? datum.p75 / 1000 : null,
    p90: typeof datum.p90 === "number" ? datum.p90 / 1000 : null,
    p95: typeof datum.p95 === "number" ? datum.p95 / 1000 : null,
    p99: typeof datum.p99 === "number" ? datum.p99 / 1000 : null,
    p999: typeof datum.p999 === "number" ? datum.p999 / 1000 : null,
    max: typeof datum.max === "number" ? datum.max / 1000 : null,
  }));
  const hasData = chartData.some((datum) => datum.max != null);

  const timeTickFormatter = useBinTimeTickFormatter({ scale });

  const colors = useSequentialChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();

  return (
    <TimeRangeChartBrush onTimeRangeSelected={onTimeRangeSelected}>
      {({ chartProps }) => (
        <ChartEmptyStateOverlay
          isEmpty={!hasData}
          message="No data in this time range"
          chartType="line"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={compactChartMargin}
              syncId={PROJECT_METRICS_CHART_SYNC_ID}
              {...chartProps}
            >
              <CartesianGrid {...defaultCartesianGridProps} />
              <XAxis
                {...compactTimeXAxisProps}
                domain={[timeRange.start.getTime(), timeRange.end.getTime()]}
                tickFormatter={(x) => timeTickFormatter(new Date(x))}
              />
              <YAxis
                {...compactYAxisProps}
                tickFormatter={(seconds) => latencyMsFormatter(seconds * 1000)}
              />
              <Line
                type="monotone"
                dataKey="p50"
                stroke={colors.blue400}
                strokeWidth={1}
                activeDot={{ r: 4 }}
                name="P50"
                hide={isDataKeyHidden("p50")}
              />
              <Line
                type="monotone"
                dataKey="p75"
                stroke={colors.blue400}
                strokeWidth={1}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                name="P75"
                hide={isDataKeyHidden("p75")}
              />
              <Line
                type="monotone"
                dataKey="p90"
                stroke={colors.blue500}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                name="P90"
                hide={isDataKeyHidden("p90")}
              />
              <Line
                type="monotone"
                dataKey="p95"
                stroke={colors.blue600}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                name="P95"
                hide={isDataKeyHidden("p95")}
              />
              <Line
                type="monotone"
                dataKey="p99"
                stroke={colors.blue700}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                name="P99"
                hide={isDataKeyHidden("p99")}
              />
              <Line
                type="monotone"
                dataKey="p999"
                stroke={colors.blue800}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                name="P99.9"
                hide={isDataKeyHidden("p999")}
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
                hide={isDataKeyHidden("max")}
              />
              <InteractiveLegend
                {...compactLegendProps}
                hiddenDataKeys={hiddenDataKeys}
                iconType="line"
                iconSize={8}
                onToggleDataKey={toggleDataKey}
              />
              <Tooltip content={TooltipContent} {...defaultTooltipProps} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartEmptyStateOverlay>
      )}
    </TimeRangeChartBrush>
  );
}
