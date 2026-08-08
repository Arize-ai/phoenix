import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartEmptyStateOverlay,
  InteractiveLegend,
  TimeRangeChartBrush,
  compactChartMargin,
  compactTimeXAxisProps,
  compactYAxisProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  compactLegendProps,
  useBinTimeTickFormatter,
  useInteractiveLegend,
  useSemanticChartColors,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { CountTimeSeriesTooltipContent } from "@phoenix/pages/project/metrics/CountTimeSeriesTooltipContent";
import type { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";
import {
  PROJECT_METRICS_CHART_SYNC_ID,
  useMetricQueryFetchOptions,
} from "@phoenix/pages/project/metrics/types";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import type { TraceCountTimeSeriesQuery } from "./__generated__/TraceCountTimeSeriesQuery.graphql";

export function TraceCountTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
}: ProjectMetricViewProps) {
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<TraceCountTimeSeriesQuery>(
    graphql`
      query TraceCountTimeSeriesQuery(
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
                okCount
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
    },
    useMetricQueryFetchOptions()
  );

  const chartData = useMemo(
    () =>
      (data.project.traceCountByStatusTimeSeries?.data ?? []).map((datum) => ({
        timestamp: new Date(datum.timestamp).getTime(),
        ok: datum.okCount,
        error: datum.errorCount,
        total: datum.totalCount,
      })),
    [data.project.traceCountByStatusTimeSeries?.data]
  );
  const hasData = chartData.some((datum) => datum.total > 0);

  const timeTickFormatter = useBinTimeTickFormatter({ scale });

  const colors = useSequentialChartColors();
  const SemanticChartColors = useSemanticChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  return (
    <TimeRangeChartBrush onTimeRangeSelected={onTimeRangeSelected}>
      {({ chartProps }) => (
        <ChartEmptyStateOverlay
          isEmpty={!hasData}
          message="No data in this time range"
          chartType="bar"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={compactChartMargin}
              barSize={10}
              syncId={PROJECT_METRICS_CHART_SYNC_ID}
              {...chartProps}
            >
              <XAxis
                {...compactTimeXAxisProps}
                domain={[timeRange.start.getTime(), timeRange.end.getTime()]}
                tickFormatter={(x) => timeTickFormatter(new Date(x))}
              />
              <YAxis
                {...compactYAxisProps}
                allowDecimals={false}
                tickFormatter={(x) => intFormatter(x)}
              />
              <CartesianGrid {...defaultCartesianGridProps} />
              <Tooltip
                content={CountTimeSeriesTooltipContent}
                // TODO formalize this
                {...defaultTooltipProps}
              />
              <Bar
                dataKey="error"
                stackId="a"
                fill={SemanticChartColors.danger}
                hide={isDataKeyHidden("error")}
              />
              <Bar
                dataKey="ok"
                stackId="a"
                fill={colors.gray300}
                hide={isDataKeyHidden("ok")}
                radius={[2, 2, 0, 0]}
              />

              <InteractiveLegend
                iconType="circle"
                iconSize={8}
                {...compactLegendProps}
                hiddenDataKeys={hiddenDataKeys}
                onToggleDataKey={toggleDataKey}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartEmptyStateOverlay>
      )}
    </TimeRangeChartBrush>
  );
}
