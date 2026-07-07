import { useLazyLoadQuery } from "react-relay";
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
import { spanCountTimeSeriesQuery } from "./SpanCountTimeSeries";

/**
 * A time series of error counts for the spans matching a filter condition,
 * e.g. `span_kind == "LLM"`. Reuses the span count query so it shares a
 * single request and store entry with the corresponding count chart.
 */
export function SpanErrorsTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
  filterCondition,
  emptyMessage,
}: ProjectMetricViewProps & {
  filterCondition: string;
  /**
   * Shown when there are spans but none of them errored
   */
  emptyMessage: string;
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

  const chartData = (data.project.spanCountTimeSeries?.data ?? []).map(
    (datum) => ({
      timestamp: new Date(datum.timestamp).getTime(),
      error: datum.errorCount,
      total: datum.totalCount ?? 0,
    })
  );
  const hasSpans = chartData.some((datum) => datum.total > 0);
  // Traffic with zero errors would otherwise draw as a blank chart, so
  // surface it as an explicit (good news) empty state
  const hasErrors = chartData.some((datum) => (datum.error ?? 0) > 0);

  const timeTickFormatter = useBinTimeTickFormatter({ scale });

  const SemanticChartColors = useSemanticChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  return (
    <TimeRangeChartBrush onTimeRangeSelected={onTimeRangeSelected}>
      {({ chartProps }) => (
        <ChartEmptyStateOverlay
          isEmpty={!hasErrors}
          message={hasSpans ? emptyMessage : "No data in this time range"}
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
