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
import { intShortFormatter } from "@phoenix/utils/numberFormatUtils";

import type { SpanCountTimeSeriesQuery } from "./__generated__/SpanCountTimeSeriesQuery.graphql";

/**
 * Shared with SpanErrorsTimeSeries so a count chart and its errors chart
 * issue one identical query that Relay can dedupe and serve from the store.
 */
export const spanCountTimeSeriesQuery = graphql`
  query SpanCountTimeSeriesQuery(
    $projectId: ID!
    $timeRange: TimeRange!
    $timeBinConfig: TimeBinConfig!
    $filterCondition: String
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
            totalCount
          }
        }
      }
    }
  }
`;

/**
 * A time series of span counts in the project, broken down by status.
 * Optionally scoped to the spans matching a filter condition, e.g.
 * `span_kind == "LLM"`.
 */
export function SpanCountTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
  filterCondition = null,
}: ProjectMetricViewProps & {
  filterCondition?: string | null;
}) {
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<SpanCountTimeSeriesQuery>(
    spanCountTimeSeriesQuery,
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
      filterCondition,
    },
    useMetricQueryFetchOptions()
  );

  const chartData = useMemo(
    () =>
      (data.project.spanCountTimeSeries?.data ?? []).map((datum) => ({
        timestamp: new Date(datum.timestamp).getTime(),
        error: datum.errorCount,
        unset: datum.unsetCount,
        ok: datum.okCount,
        total: datum.totalCount ?? 0,
      })),
    [data.project.spanCountTimeSeries?.data]
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
                tickFormatter={(x) => intShortFormatter(x)}
              />
              <CartesianGrid {...defaultCartesianGridProps} />
              <Tooltip
                content={CountTimeSeriesTooltipContent}
                {...defaultTooltipProps}
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
                {...compactLegendProps}
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
