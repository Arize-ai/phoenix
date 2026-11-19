import { useState } from "react";
import { graphql } from "react-relay";
import type { TooltipContentProps } from "recharts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Text, useNullableTimeRangeContext } from "@phoenix/components";
import type { ColorPreviewShape } from "@phoenix/components/chart";
import {
  CATEGORICAL_CHART_COLORS,
  ChartEmptyStateOverlay,
  ChartSkeleton,
  ChartResponsiveContainer,
  ChartTooltip,
  ChartTooltipItem,
  compactChartMargin,
  compactLegendProps,
  compactTimeXAxisProps,
  compactYAxisProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  defaultXAxisProps,
  defaultYAxisProps,
  getCategoryChartColor,
  InteractiveLegend,
  stackedBarSeparatorProps,
  TimeRangeChartBrush,
  truncateModelName,
  useBinTimeTickFormatter,
  useCategoryChartColors,
  useGrayscaleCategoricalColors,
  useInteractiveLegend,
} from "@phoenix/components/chart";
import {
  getTimeRangeFromLastNTimeRangeKey,
  isLastNTimeRangeKey,
} from "@phoenix/components/datetime/utils";
import { useRefreshingLazyLoadQuery } from "@phoenix/hooks/useRefreshingLazyLoadQuery";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { formatLag } from "@phoenix/pages/project/evaluators/projectEvaluatorFormat";
import type { QueueChartTimeAxis } from "@phoenix/pages/project/metrics/EvaluationQueueCharts";
import {
  QueueSizeChart,
  QueueThroughputChart,
} from "@phoenix/pages/project/metrics/EvaluationQueueCharts";
import {
  getQueueSizeRows,
  getQueueThroughputRows,
} from "@phoenix/pages/project/metrics/queueThroughput";
import type { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";
import {
  PROJECT_METRICS_CHART_SYNC_ID,
  useMetricQueryFetchKey,
} from "@phoenix/pages/project/metrics/types";
import {
  costFormatter,
  floatShortFormatter,
  formatPercentShort,
  intFormatter,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type {
  EvaluatorActivityChartsQuery,
  EvaluatorActivityChartsQuery$variables,
} from "./__generated__/EvaluatorActivityChartsQuery.graphql";
import type { EvaluatorQueueSizeChartQuery } from "./__generated__/EvaluatorQueueSizeChartQuery.graphql";
import type {
  EvaluatorSeries,
  EvaluatorSeriesMetric,
} from "./evaluatorActivity";
import {
  getDurationTicks,
  getEvaluatorCostRanking,
  getEvaluatorSeries,
  getEvaluatorTimeSeriesRows,
} from "./evaluatorActivity";

/**
 * At most two rows of evaluators, scrolling past that, so a project with many
 * evaluators keeps room in the strip to draw them.
 */
const evaluatorLegendProps = {
  ...compactLegendProps,
  wrapperStyle: {
    ...compactLegendProps.wrapperStyle,
    maxHeight:
      "calc(var(--global-dimension-size-50) + 2 * var(--global-line-height-xs) + var(--global-dimension-size-100))",
    overflowY: "auto",
  },
} satisfies typeof compactLegendProps;

/**
 * What a chart's time range is, apart from where "now" falls: a live range
 * is its preset, so each refresh that moves it forward is the same range,
 * whatever its length; any other range is its bounds.
 */
function useTimeRangeIdentity(timeRange: TimeRange): string {
  const timeRangeKey = useNullableTimeRangeContext()?.timeRange.timeRangeKey;
  const isLiveRange =
    isLastNTimeRangeKey(timeRangeKey) &&
    getTimeRangeFromLastNTimeRangeKey(
      timeRangeKey,
      timeRange.end.getTime()
    ).start?.getTime() === timeRange.start.getTime();
  return isLiveRange
    ? timeRangeKey
    : `${timeRange.start.toISOString()}/${timeRange.end.toISOString()}`;
}

/**
 * The subject of a chart query, for `useRefreshingLazyLoadQuery`: its
 * variables, with the time range named by {@link useTimeRangeIdentity}. A live
 * refresh keeps it, so the chart keeps its data up while the next loads; a
 * change of preset, range, bin scale or project does not, so the chart shows
 * a skeleton rather than the previous range's data.
 */
function useChartSubjectKey({
  variables,
  timeRange,
}: {
  variables: EvaluatorActivityChartsQuery$variables;
  timeRange: TimeRange;
}): string {
  const timeRangeIdentity = useTimeRangeIdentity(timeRange);
  return JSON.stringify({ ...variables, timeRange: timeRangeIdentity });
}

/**
 * The time range and bin scale that loaded chart data covers, which differ
 * from the requested ones while a newer range loads.
 */
function getLoadedChartRange({
  variables,
  timeRange,
  scale,
}: {
  /** The activity or queue size query's variables, which are the same. */
  variables: EvaluatorActivityChartsQuery$variables;
  timeRange: TimeRange;
  scale: TimeBinScale;
}) {
  return {
    timeRange: {
      start: variables.timeRange.start
        ? new Date(variables.timeRange.start)
        : timeRange.start,
      end: variables.timeRange.end
        ? new Date(variables.timeRange.end)
        : timeRange.end,
    },
    scale: variables.timeBinConfig.scale ?? scale,
  };
}

/**
 * Every evaluator chart reads the same query, so the charts in a strip share
 * one request and one copy of the data. While another range loads,
 * `isOtherRangeLoading` is set so the charts show a skeleton rather than the
 * previous range's data under the new range.
 */
function useEvaluatorActivity({
  projectId,
  timeRange,
}: Pick<ProjectMetricViewProps, "projectId" | "timeRange">) {
  const requestedScale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const requestedVariables = {
    projectId,
    timeRange: {
      start: timeRange.start?.toISOString(),
      end: timeRange.end?.toISOString(),
    },
    timeBinConfig: { scale: requestedScale, utcOffsetMinutes },
  };
  const { data, variables, isOtherSubjectLoading } =
    useRefreshingLazyLoadQuery<EvaluatorActivityChartsQuery>({
      query: graphql`
        query EvaluatorActivityChartsQuery(
          $projectId: ID!
          $timeRange: TimeRange!
          $timeBinConfig: TimeBinConfig!
        ) {
          project: node(id: $projectId) {
            ... on Project {
              evaluationActivity(
                timeRange: $timeRange
                timeBinConfig: $timeBinConfig
              ) {
                groups {
                  projectEvaluator {
                    id
                    name
                  }
                  evaluatedCount
                  failedCount
                  cost
                }
                series {
                  timestamp
                  groups {
                    projectEvaluator {
                      id
                    }
                    evaluatedCount
                    failedCount
                    addedCount
                    lagP95Seconds
                    cost
                  }
                }
              }
            }
          }
        }
      `,
      variables: requestedVariables,
      fetchKey: useMetricQueryFetchKey(),
      subjectKey: useChartSubjectKey({
        variables: requestedVariables,
        timeRange,
      }),
    });
  const loaded = getLoadedChartRange({
    variables,
    timeRange,
    scale: requestedScale,
  });
  const groups = data.project.evaluationActivity?.groups ?? [];
  const bins = data.project.evaluationActivity?.series ?? [];
  const { series, getDataKey } = getEvaluatorSeries({
    groups,
    paletteSize: CATEGORICAL_CHART_COLORS.length,
  });
  return {
    scale: loaded.scale,
    timeRange: loaded.timeRange,
    isOtherRangeLoading: isOtherSubjectLoading,
    groups,
    bins,
    series,
    getDataKey,
  };
}

/** An evaluator's color, the same in every evaluator chart. */
function useEvaluatorSeriesColor() {
  const colors = useCategoryChartColors();
  const grayscaleColors = useGrayscaleCategoricalColors();
  return ({ colorIndex }: EvaluatorSeries) =>
    colorIndex == null
      ? grayscaleColors.gray3
      : getCategoryChartColor({ index: colorIndex, colors });
}

function EvaluatorTimeSeriesTooltipContent({
  active,
  payload,
  label,
  formatValue,
  shape,
}: Partial<TooltipContentProps> & {
  formatValue: (value: number) => string;
  shape: ColorPreviewShape;
}) {
  const { fullTimeFormatter } = useTimeFormatters();
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <ChartTooltip>
      {label && (
        <Text weight="heavy" size="S">
          {fullTimeFormatter(new Date(Number(label)))}
        </Text>
      )}
      {payload.map((entry) =>
        entry.value == null ||
        (payload.length > 1 && entry.value === 0) ? null : (
          <ChartTooltipItem
            key={String(entry.dataKey)}
            color={entry.color ?? "transparent"}
            shape={shape}
            name={String(entry.name ?? entry.dataKey)}
            value={formatValue(Number(entry.value))}
          />
        )
      )}
    </ChartTooltip>
  );
}

type EvaluatorTimeSeriesChartProps = ProjectMetricViewProps & {
  metric: EvaluatorSeriesMetric;
  mark: "bar" | "line";
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  emptyMessage: string;
};

function EvaluatorTimeSeriesChart({
  projectId,
  timeRange,
  onTimeRangeSelected,
  metric,
  mark,
  formatValue,
  formatTick,
  emptyMessage,
}: EvaluatorTimeSeriesChartProps) {
  const {
    scale,
    timeRange: loadedTimeRange,
    isOtherRangeLoading,
    bins,
    series,
    getDataKey,
  } = useEvaluatorActivity({
    projectId,
    timeRange,
  });
  const chartData = getEvaluatorTimeSeriesRows({
    bins,
    series,
    getDataKey,
    metric,
  });
  const isLag = metric === "lagP95Seconds";
  const hasData = chartData.some((row) =>
    series.some(({ dataKey }) => {
      const value = row[dataKey];
      return value != null && (isLag || value > 0);
    })
  );
  const lagTicks = isLag
    ? getDurationTicks(
        Math.max(
          0,
          ...chartData.flatMap((row) =>
            series.map(({ dataKey }) => row[dataKey] ?? 0)
          )
        )
      )
    : undefined;
  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const getColor = useEvaluatorSeriesColor();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  // Hovering an evaluator in the legend brings its series forward.
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const shape = mark === "bar" ? "circle" : "line";
  if (isOtherRangeLoading) {
    return <ChartSkeleton />;
  }
  return (
    <TimeRangeChartBrush
      onTimeRangeSelected={onTimeRangeSelected}
      scale={scale}
    >
      {({ chartProps }) => (
        <ChartEmptyStateOverlay
          isEmpty={!hasData}
          message={emptyMessage}
          chartType={mark}
        >
          <ChartResponsiveContainer>
            <ComposedChart
              data={chartData}
              margin={compactChartMargin}
              barSize={10}
              syncId={PROJECT_METRICS_CHART_SYNC_ID}
              {...chartProps}
            >
              <CartesianGrid {...defaultCartesianGridProps} />
              <XAxis
                {...compactTimeXAxisProps}
                domain={[
                  loadedTimeRange.start.getTime(),
                  loadedTimeRange.end.getTime(),
                ]}
                tickFormatter={(x) => timeTickFormatter(new Date(x))}
              />
              <YAxis
                {...compactYAxisProps}
                tickFormatter={formatTick}
                ticks={lagTicks}
                domain={
                  lagTicks ? [0, lagTicks[lagTicks.length - 1]] : undefined
                }
              />
              <Tooltip
                content={
                  <EvaluatorTimeSeriesTooltipContent
                    formatValue={formatValue}
                    shape={shape}
                  />
                }
                {...defaultTooltipProps}
              />
              {series.map((evaluatorSeries) => {
                const { dataKey } = evaluatorSeries;
                const isDimmed =
                  highlightedKey != null && highlightedKey !== dataKey;
                return mark === "bar" ? (
                  <Bar
                    key={dataKey}
                    dataKey={dataKey}
                    name={evaluatorSeries.name}
                    stackId="evaluators"
                    {...stackedBarSeparatorProps}
                    fill={getColor(evaluatorSeries)}
                    fillOpacity={isDimmed ? 0.2 : 1}
                    hide={isDataKeyHidden(dataKey)}
                    isAnimationActive={false}
                  />
                ) : (
                  <Line
                    key={dataKey}
                    type="monotone"
                    dataKey={dataKey}
                    name={evaluatorSeries.name}
                    stroke={getColor(evaluatorSeries)}
                    strokeWidth={highlightedKey === dataKey ? 2.5 : 1.5}
                    strokeOpacity={isDimmed ? 0.2 : 1}
                    // A bin where nothing finished has no lag; bridge it so
                    // each evaluator reads as one line.
                    connectNulls={isLag}
                    dot={false}
                    activeDot={{ r: 4 }}
                    hide={isDataKeyHidden(dataKey)}
                    isAnimationActive={false}
                  />
                );
              })}
              <InteractiveLegend
                {...evaluatorLegendProps}
                hiddenDataKeys={hiddenDataKeys}
                iconType={shape}
                iconSize={8}
                onToggleDataKey={toggleDataKey}
                onMouseEnter={(entry) =>
                  setHighlightedKey(
                    typeof entry.dataKey === "string" ? entry.dataKey : null
                  )
                }
                onMouseLeave={() => setHighlightedKey(null)}
              />
            </ComposedChart>
          </ChartResponsiveContainer>
        </ChartEmptyStateOverlay>
      )}
    </TimeRangeChartBrush>
  );
}

export function EvaluationsByEvaluatorTimeSeries(
  props: ProjectMetricViewProps
) {
  return (
    <EvaluatorTimeSeriesChart
      {...props}
      metric="evaluatedCount"
      mark="bar"
      formatValue={intFormatter}
      formatTick={intShortFormatter}
      emptyMessage="No data in this time range"
    />
  );
}

export function EvaluationLagByEvaluatorTimeSeries(
  props: ProjectMetricViewProps
) {
  return (
    <EvaluatorTimeSeriesChart
      {...props}
      metric="lagP95Seconds"
      mark="line"
      formatValue={formatLag}
      formatTick={formatLag}
      emptyMessage="No data in this time range"
    />
  );
}

export function FailuresByEvaluatorTimeSeries(props: ProjectMetricViewProps) {
  return (
    <EvaluatorTimeSeriesChart
      {...props}
      metric="failedCount"
      mark="line"
      formatValue={intFormatter}
      formatTick={intShortFormatter}
      emptyMessage="No failed evaluations in this time range"
    />
  );
}

export function CostOverTimeByEvaluatorTimeSeries(
  props: ProjectMetricViewProps
) {
  return (
    <EvaluatorTimeSeriesChart
      {...props}
      metric="cost"
      mark="bar"
      formatValue={costFormatter}
      formatTick={(cost) => `$${floatShortFormatter(cost)}`}
      emptyMessage="No data in this time range"
    />
  );
}

export function CostByEvaluator({
  projectId,
  timeRange,
}: ProjectMetricViewProps) {
  const { isOtherRangeLoading, groups, series, getDataKey } =
    useEvaluatorActivity({
      projectId,
      timeRange,
    });
  const getColor = useEvaluatorSeriesColor();
  if (isOtherRangeLoading) {
    return <ChartSkeleton />;
  }
  const chartData = getEvaluatorCostRanking({ groups, series, getDataKey });
  const seriesByDataKey = new Map(series.map((s) => [s.dataKey, s]));
  return (
    <ChartEmptyStateOverlay
      isEmpty={chartData.length === 0}
      message="No evaluator cost in this time range"
      chartType="barHorizontal"
    >
      <ChartResponsiveContainer>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ ...compactChartMargin, right: 56 }}
          barSize={10}
        >
          <XAxis {...defaultXAxisProps} type="number" hide />
          <YAxis
            {...defaultYAxisProps}
            dataKey="name"
            type="category"
            width={120}
            axisLine={false}
            tickLine={false}
            tickMargin={4}
            tickFormatter={truncateModelName}
          />
          <Tooltip
            content={({ active, payload }) => {
              const rank = payload?.[0]?.payload as
                | (typeof chartData)[number]
                | undefined;
              if (!active || rank == null) {
                return null;
              }
              const evaluatorSeries = seriesByDataKey.get(rank.dataKey);
              return (
                <ChartTooltip>
                  <ChartTooltipItem
                    color={
                      evaluatorSeries
                        ? getColor(evaluatorSeries)
                        : "transparent"
                    }
                    shape="circle"
                    name={rank.name}
                    value={costFormatter(rank.cost)}
                  />
                  <Text size="S" color="text-700">
                    {`${formatPercentShort(rank.share)} of the total`}
                  </Text>
                </ChartTooltip>
              );
            }}
            {...defaultTooltipProps}
          />
          <Bar dataKey="cost" radius={2} isAnimationActive={false}>
            {chartData.map((rank) => {
              const evaluatorSeries = seriesByDataKey.get(rank.dataKey);
              return (
                <Cell
                  key={rank.dataKey}
                  fill={evaluatorSeries ? getColor(evaluatorSeries) : undefined}
                />
              );
            })}
            <LabelList
              dataKey="cost"
              position="right"
              formatter={(value) => costFormatter(Number(value))}
              fill="var(--chart-axis-text-color)"
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}

/**
 * The project's evaluations in queue at each bin's end, keyed by the bin's
 * start. Its own request, made only while a queue chart is shown: it counts
 * every evaluation in queue. Both queue charts send the same variables, so
 * they share it.
 */
function useQueueSizeByTimestamp({
  projectId,
  timeRange,
}: Pick<ProjectMetricViewProps, "projectId" | "timeRange">) {
  const requestedScale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const requestedVariables = {
    projectId,
    timeRange: {
      start: timeRange.start?.toISOString(),
      end: timeRange.end?.toISOString(),
    },
    timeBinConfig: { scale: requestedScale, utcOffsetMinutes },
  };
  const { data, isOtherSubjectLoading } =
    useRefreshingLazyLoadQuery<EvaluatorQueueSizeChartQuery>({
      query: graphql`
        query EvaluatorQueueSizeChartQuery(
          $projectId: ID!
          $timeRange: TimeRange!
          $timeBinConfig: TimeBinConfig!
        ) {
          project: node(id: $projectId) {
            ... on Project {
              evaluationActivity(
                timeRange: $timeRange
                timeBinConfig: $timeBinConfig
              ) {
                series {
                  timestamp
                  queueSize
                }
              }
            }
          }
        }
      `,
      variables: requestedVariables,
      fetchKey: useMetricQueryFetchKey(),
      subjectKey: useChartSubjectKey({
        variables: requestedVariables,
        timeRange,
      }),
    });
  const queueSizeByTimestamp = new Map<number, number>(
    (data.project.evaluationActivity?.series ?? []).map((bin) => [
      new Date(bin.timestamp).getTime(),
      bin.queueSize,
    ])
  );
  return { queueSizeByTimestamp, isOtherRangeLoading: isOtherSubjectLoading };
}

/**
 * What a queue chart draws: the activity's bins and the queue size at each,
 * on the range they were loaded for. `isOtherRangeLoading` is set while
 * either request loads another range.
 */
function useQueueChartData({
  projectId,
  timeRange,
}: Pick<ProjectMetricViewProps, "projectId" | "timeRange">) {
  const activity = useEvaluatorActivity({ projectId, timeRange });
  const queueSize = useQueueSizeByTimestamp({ projectId, timeRange });
  const timeTickFormatter = useBinTimeTickFormatter({ scale: activity.scale });
  const xAxis: QueueChartTimeAxis = {
    domain: [
      activity.timeRange.start.getTime(),
      activity.timeRange.end.getTime(),
    ],
    tickFormatter: (x) => timeTickFormatter(new Date(x)),
  };
  return {
    scale: activity.scale,
    bins: activity.bins,
    queueSizeByTimestamp: queueSize.queueSizeByTimestamp,
    xAxis,
    isOtherRangeLoading:
      activity.isOtherRangeLoading || queueSize.isOtherRangeLoading,
  };
}

/** The project's evaluations added and completed per bin, mirrored. */
export function EvaluationQueueThroughputTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
}: ProjectMetricViewProps) {
  const { scale, bins, queueSizeByTimestamp, xAxis, isOtherRangeLoading } =
    useQueueChartData({ projectId, timeRange });
  if (isOtherRangeLoading) {
    return <ChartSkeleton />;
  }
  return (
    <QueueThroughputChart
      rows={getQueueThroughputRows({ bins, queueSizeByTimestamp })}
      xAxis={xAxis}
      onTimeRangeSelected={onTimeRangeSelected}
      scale={scale}
      syncId={PROJECT_METRICS_CHART_SYNC_ID}
    />
  );
}

/** The project's evaluations in queue at each bin's end, and those processed. */
export function EvaluationQueueSizeTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
}: ProjectMetricViewProps) {
  const { scale, bins, queueSizeByTimestamp, xAxis, isOtherRangeLoading } =
    useQueueChartData({ projectId, timeRange });
  if (isOtherRangeLoading) {
    return <ChartSkeleton />;
  }
  return (
    <QueueSizeChart
      rows={getQueueSizeRows({ bins, queueSizeByTimestamp })}
      xAxis={xAxis}
      onTimeRangeSelected={onTimeRangeSelected}
      scale={scale}
      syncId={PROJECT_METRICS_CHART_SYNC_ID}
    />
  );
}
