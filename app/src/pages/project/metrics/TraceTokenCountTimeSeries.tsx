import { graphql, useLazyLoadQuery } from "react-relay";
import type { TooltipContentProps } from "recharts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Text } from "@phoenix/components";
import {
  ChartTooltip,
  ChartTooltipItem,
  InteractiveLegend,
  TimeRangeChartBrush,
  defaultCartesianGridProps,
  defaultLegendProps,
  defaultTimeXAxisProps,
  defaultYAxisProps,
  useBinTimeTickFormatter,
  useCategoryChartColors,
  useInteractiveLegend,
} from "@phoenix/components/chart";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import type { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";
import {
  intFormatter,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type { TraceTokenCountTimeSeriesQuery } from "./__generated__/TraceTokenCountTimeSeriesQuery.graphql";

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
        {payload.map((entry) => {
          const name = String(entry.dataKey ?? entry.name ?? "unknown");
          return (
            <ChartTooltipItem
              color={entry.color ?? "transparent"}
              key={name}
              shape="circle"
              name={name}
              value={
                typeof entry.value === "number"
                  ? intFormatter(entry.value)
                  : "--"
              }
            />
          );
        })}
      </ChartTooltip>
    );
  }

  return null;
}

export function TraceTokenCountTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
}: ProjectMetricViewProps) {
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<TraceTokenCountTimeSeriesQuery>(
    graphql`
      query TraceTokenCountTimeSeriesQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            traceTokenCountTimeSeries(
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) {
              data {
                timestamp
                promptTokenCount
                completionTokenCount
                totalTokenCount
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

  const chartData = (data.project.traceTokenCountTimeSeries?.data ?? []).map(
    (datum) => ({
      timestamp: new Date(datum.timestamp).getTime(),
      prompt: datum.promptTokenCount ?? 0,
      completion: datum.completionTokenCount ?? 0,
    })
  );

  const timeTickFormatter = useBinTimeTickFormatter({ scale });

  const colors = useCategoryChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  return (
    <TimeRangeChartBrush onTimeRangeSelected={onTimeRangeSelected}>
      {({ chartProps }) => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 0, right: 18, left: 8, bottom: 0 }}
            barSize={10}
            syncId={"projectMetrics"}
            {...chartProps}
          >
            <CartesianGrid {...defaultCartesianGridProps} vertical={false} />
            <XAxis
              {...defaultTimeXAxisProps}
              domain={[timeRange.start.getTime(), timeRange.end.getTime()]}
              tickFormatter={(x) => timeTickFormatter(new Date(x))}
            />
            <YAxis
              {...defaultYAxisProps}
              width={70}
              tickFormatter={(x) => intShortFormatter(x)}
              label={{
                value: "Tokens",
                angle: -90,
                dx: -28,
                style: {
                  textAnchor: "middle",
                  fill: "var(--chart-axis-label-color)",
                },
              }}
              style={{ fill: "var(--global-text-color-700)" }}
            />
            <Tooltip
              content={TooltipContent}
              // TODO formalize this
              cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
            />
            <Bar
              dataKey="prompt"
              stackId="a"
              fill={colors.category1}
              hide={isDataKeyHidden("prompt")}
            />
            <Bar
              dataKey="completion"
              stackId="a"
              fill={colors.category2}
              hide={isDataKeyHidden("completion")}
              radius={[2, 2, 0, 0]}
            />

            <InteractiveLegend
              {...defaultLegendProps}
              hiddenDataKeys={hiddenDataKeys}
              iconType="circle"
              iconSize={8}
              onToggleDataKey={toggleDataKey}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </TimeRangeChartBrush>
  );
}
