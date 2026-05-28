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
  useInteractiveLegend,
  useSemanticChartColors,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import type { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";
import {
  intFormatter,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type { ToolSpanCountTimeSeriesQuery } from "./__generated__/ToolSpanCountTimeSeriesQuery.graphql";

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
              value={intFormatter(Number(entry.value))}
            />
          );
        })}
      </ChartTooltip>
    );
  }

  return null;
}

export function ToolSpanCountTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
}: ProjectMetricViewProps) {
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<ToolSpanCountTimeSeriesQuery>(
    graphql`
      query ToolSpanCountTimeSeriesQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
        $filterCondition: String!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            spanCountTimeSeries(
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
              filterCondition: $filterCondition
            ) {
              data {
                timestamp
                okCount
                errorCount
                unsetCount
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
      filterCondition: 'span_kind == "TOOL"',
    }
  );

  const chartData = (data.project.spanCountTimeSeries?.data ?? []).map(
    (datum) => ({
      timestamp: new Date(datum.timestamp).getTime(),
      error: datum.errorCount,
      unset: datum.unsetCount,
      ok: datum.okCount,
    })
  );

  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const colors = useSequentialChartColors();
  const SemanticChartColors = useSemanticChartColors();
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
            <XAxis
              {...defaultTimeXAxisProps}
              domain={[timeRange.start.getTime(), timeRange.end.getTime()]}
              tickFormatter={(x) => timeTickFormatter(new Date(x))}
            />
            <YAxis
              {...defaultYAxisProps}
              width={55}
              tickFormatter={(x) => intShortFormatter(x)}
              label={{
                value: "Count",
                angle: -90,
                dx: -28,
                style: {
                  textAnchor: "middle",
                  fill: "var(--chart-axis-label-color)",
                },
              }}
            />
            <CartesianGrid {...defaultCartesianGridProps} vertical={false} />
            <Tooltip
              content={TooltipContent}
              // TODO formalize this
              cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
            />
            <Bar
              dataKey="error"
              stackId="a"
              fill={SemanticChartColors.danger}
              hide={isDataKeyHidden("error")}
            />
            <Bar
              dataKey="unset"
              stackId="a"
              fill={colors.gray500}
              hide={isDataKeyHidden("unset")}
            />
            <Bar
              dataKey="ok"
              stackId="a"
              fill={colors.gray300}
              hide={isDataKeyHidden("ok")}
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
