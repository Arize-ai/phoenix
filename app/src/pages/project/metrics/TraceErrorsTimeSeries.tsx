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
  ChartEmptyStateOverlay,
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
} from "@phoenix/components/chart";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import type { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import type { TraceErrorsTimeSeriesQuery } from "./__generated__/TraceErrorsTimeSeriesQuery.graphql";

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});

function TooltipContent({ active, payload, label }: TooltipContentProps) {
  const SemanticChartColors = useSemanticChartColors();
  const { fullTimeFormatter } = useTimeFormatters();
  if (active && payload && payload.length) {
    const errorValue = payload[0]?.value ?? null;
    const errorString =
      typeof errorValue === "number"
        ? numberFormatter.format(errorValue)
        : "--";
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(Number(label))
          )}`}</Text>
        )}
        <ChartTooltipItem
          color={SemanticChartColors.danger}
          shape="circle"
          name="error"
          value={errorString}
        />
      </ChartTooltip>
    );
  }

  return null;
}

export function TraceErrorsTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
}: ProjectMetricViewProps) {
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<TraceErrorsTimeSeriesQuery>(
    graphql`
      query TraceErrorsTimeSeriesQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            traceCountByStatusTimeSeries(
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) {
              data {
                timestamp
                errorCount
                totalCount
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

  const chartData = (data.project.traceCountByStatusTimeSeries?.data ?? []).map(
    (datum) => ({
      timestamp: new Date(datum.timestamp).getTime(),
      error: datum.errorCount,
      total: datum.totalCount,
    })
  );
  const hasData = chartData.some((datum) => datum.total > 0);

  const timeTickFormatter = useBinTimeTickFormatter({ scale });

  const SemanticChartColors = useSemanticChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  return (
    <TimeRangeChartBrush onTimeRangeSelected={onTimeRangeSelected}>
      {({ chartProps }) => (
        <ChartEmptyStateOverlay
          isEmpty={!hasData}
          message="No data in this time range"
        >
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
                tickFormatter={(x) => intFormatter(x)}
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
        </ChartEmptyStateOverlay>
      )}
    </TimeRangeChartBrush>
  );
}
