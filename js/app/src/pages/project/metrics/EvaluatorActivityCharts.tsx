import { graphql, useLazyLoadQuery } from "react-relay";
import type { TooltipContentProps } from "recharts";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Text } from "@phoenix/components";
import type { ColorPreviewShape } from "@phoenix/components/chart";
import {
  CATEGORICAL_CHART_COLORS,
  ChartEmptyStateOverlay,
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
  useSemanticChartColors,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { DEGRADED_WAIT_MS } from "@phoenix/pages/project/evaluators/evaluationQueueStatParts";
import { formatLag } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";
import {
  PROJECT_METRICS_CHART_SYNC_ID,
  useMetricQueryFetchOptions,
} from "@phoenix/pages/project/metrics/types";
import {
  costFormatter,
  floatShortFormatter,
  formatPercentShort,
  intFormatter,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type { EvaluatorActivityChartsQuery } from "./__generated__/EvaluatorActivityChartsQuery.graphql";
import type {
  EvaluatorSeries,
  EvaluatorSeriesMetric,
} from "./evaluatorActivity";
import {
  getDurationTicks,
  getEvaluatorCostRanking,
  getEvaluatorSeries,
  getEvaluatorTimeSeriesRows,
  getQueueSizeRows,
} from "./evaluatorActivity";

const DEGRADED_LAG_SECONDS = DEGRADED_WAIT_MS / 1000;

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
 * Every evaluator chart reads the same query, so the charts in a strip share
 * one request and one copy of the data.
 */
function useEvaluatorActivity({
  projectId,
  timeRange,
}: Pick<ProjectMetricViewProps, "projectId" | "timeRange">) {
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const data = useLazyLoadQuery<EvaluatorActivityChartsQuery>(
    graphql`
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
                  lagP95Seconds
                  cost
                  queueSize
                }
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
      timeBinConfig: { scale, utcOffsetMinutes },
    },
    useMetricQueryFetchOptions()
  );
  const groups = data.project.evaluationActivity?.groups ?? [];
  const bins = data.project.evaluationActivity?.series ?? [];
  const { series, getDataKey } = getEvaluatorSeries({
    groups,
    paletteSize: CATEGORICAL_CHART_COLORS.length,
  });
  return { scale, groups, bins, series, getDataKey };
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
  const { scale, bins, series, getDataKey } = useEvaluatorActivity({
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
          DEGRADED_LAG_SECONDS,
          ...chartData.flatMap((row) =>
            series.map(({ dataKey }) => row[dataKey] ?? 0)
          )
        )
      )
    : undefined;
  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const getColor = useEvaluatorSeriesColor();
  const semanticColors = useSemanticChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  const shape = mark === "bar" ? "circle" : "line";
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
                domain={[timeRange.start.getTime(), timeRange.end.getTime()]}
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
              {series.map((evaluatorSeries) =>
                mark === "bar" ? (
                  <Bar
                    key={evaluatorSeries.dataKey}
                    dataKey={evaluatorSeries.dataKey}
                    name={evaluatorSeries.name}
                    stackId="evaluators"
                    {...stackedBarSeparatorProps}
                    fill={getColor(evaluatorSeries)}
                    hide={isDataKeyHidden(evaluatorSeries.dataKey)}
                  />
                ) : (
                  <Line
                    key={evaluatorSeries.dataKey}
                    type="monotone"
                    dataKey={evaluatorSeries.dataKey}
                    name={evaluatorSeries.name}
                    stroke={getColor(evaluatorSeries)}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    hide={isDataKeyHidden(evaluatorSeries.dataKey)}
                  />
                )
              )}
              {isLag && (
                <ReferenceLine
                  y={DEGRADED_LAG_SECONDS}
                  stroke={semanticColors.warning}
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                  label={{
                    value: formatLag(DEGRADED_LAG_SECONDS),
                    position: "insideTopRight",
                    fill: semanticColors.warning,
                    fontSize: 12,
                  }}
                />
              )}
              <InteractiveLegend
                {...evaluatorLegendProps}
                hiddenDataKeys={hiddenDataKeys}
                iconType={shape}
                iconSize={8}
                onToggleDataKey={toggleDataKey}
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
  const { groups, series, getDataKey } = useEvaluatorActivity({
    projectId,
    timeRange,
  });
  const getColor = useEvaluatorSeriesColor();
  const ranking = getEvaluatorCostRanking({ groups, series, getDataKey });
  const seriesByDataKey = new Map(series.map((s) => [s.dataKey, s]));
  const chartData = ranking.map((rank) => ({
    ...rank,
    label: `${costFormatter(rank.cost)} · ${formatPercentShort(rank.share)}`,
  }));
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
          margin={{ ...compactChartMargin, right: 96 }}
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
                    shape="square"
                    name={rank.name}
                    value={rank.label}
                  />
                </ChartTooltip>
              );
            }}
            {...defaultTooltipProps}
          />
          <Bar dataKey="cost" radius={[0, 2, 2, 0]}>
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
              dataKey="label"
              position="right"
              style={{
                fill: "var(--chart-axis-text-color)",
                fontSize: 12,
              }}
            />
          </Bar>
        </BarChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}

export function EvaluationQueueSizeTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
}: ProjectMetricViewProps) {
  const { scale, bins } = useEvaluatorActivity({ projectId, timeRange });
  const chartData = getQueueSizeRows(bins);
  const hasData = chartData.some(({ queueSize }) => queueSize > 0);
  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const colors = useSequentialChartColors();
  return (
    <TimeRangeChartBrush
      onTimeRangeSelected={onTimeRangeSelected}
      scale={scale}
    >
      {({ chartProps }) => (
        <ChartEmptyStateOverlay
          isEmpty={!hasData}
          message="No queued evaluations in this time range"
          chartType="line"
        >
          <ChartResponsiveContainer>
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
              <YAxis {...compactYAxisProps} tickFormatter={intShortFormatter} />
              <Tooltip
                content={
                  <EvaluatorTimeSeriesTooltipContent
                    formatValue={intFormatter}
                    shape="square"
                  />
                }
                {...defaultTooltipProps}
              />
              <Area
                type="linear"
                dataKey="queueSize"
                name="Queued evaluations"
                stroke={colors.blue500}
                fill={colors.blue500}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </ComposedChart>
          </ChartResponsiveContainer>
        </ChartEmptyStateOverlay>
      )}
    </TimeRangeChartBrush>
  );
}
