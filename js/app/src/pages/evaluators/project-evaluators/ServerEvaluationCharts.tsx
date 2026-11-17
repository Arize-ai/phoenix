import { type ReactNode, Suspense, useId, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Group, Panel } from "react-resizable-panels";
import type { LegendPayload, TooltipContentProps } from "recharts";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Alert,
  Button,
  Flex,
  Icon,
  Icons,
  MenuContainer,
  MenuTrigger,
  Text,
  View,
} from "@phoenix/components";
import {
  ChartEmptyStateOverlay,
  ChartPanel,
  ChartPanelStrip,
  ChartPanelStripSkeleton,
  ChartResponsiveContainer,
  ChartTooltip,
  ChartTooltipDivider,
  ChartTooltipItem,
  compactChartMargin,
  compactLegendProps,
  compactTimeXAxisProps,
  compactYAxisProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  defaultYAxisProps,
  getCategoryChartColor,
  InteractiveLegend,
  METRIC_CHARTS_CONTENT_PANEL_ID,
  MetricChartsPanel,
  MetricsChartSelector,
  useBinTimeTickFormatter,
  useCategoryChartColors,
  useGrayscaleCategoricalColors,
  useInteractiveLegend,
  useMetricChartsLayout,
  useSemanticChartColors,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/components/datetime";
import { ErrorBoundary } from "@phoenix/components/exception";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import type {
  ServerEvaluationChartsQuery,
  ServerEvaluationChartsQuery$data,
} from "@phoenix/pages/evaluators/project-evaluators/__generated__/ServerEvaluationChartsQuery.graphql";
import type { ServerEvaluationQueueSizeChartQuery } from "@phoenix/pages/evaluators/project-evaluators/__generated__/ServerEvaluationQueueSizeChartQuery.graphql";
import {
  formatQueueGrowthSummary,
  getAddedCount,
  getCompletedCount,
  getMirroredCountAxis,
  getTotalNet,
} from "@phoenix/pages/evaluators/project-evaluators/queueThroughput";
import type {
  ServerEvaluationChart,
  ServerEvaluationChartKey,
} from "@phoenix/pages/evaluators/project-evaluators/serverEvaluationChartCatalog";
import {
  getServerEvaluationCharts,
  SERVER_EVALUATION_CHARTS,
} from "@phoenix/pages/evaluators/project-evaluators/serverEvaluationChartCatalog";
import type {
  ProjectSeries,
  ServerProjectSeries,
} from "@phoenix/pages/evaluators/project-evaluators/serverProjectSeries";
import {
  getServerProjectSeries,
  OTHER_PROJECTS_KEY,
} from "@phoenix/pages/evaluators/project-evaluators/serverProjectSeries";
import { formatLag } from "@phoenix/pages/project/evaluators/projectEvaluatorFormat";
import { getDurationTicks } from "@phoenix/pages/project/metrics/evaluatorActivity";
import { useClosedTimeRange } from "@phoenix/pages/project/metrics/useClosedTimeRange";
import { assertUnreachable } from "@phoenix/typeUtils";
import {
  costFormatter,
  intFormatter,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

type ActivityData = ServerEvaluationChartsQuery$data;
type Activity = ActivityData["evaluationActivity"];

/** The top of an area's fill, fading to nothing at the baseline. */
const AREA_FILL_TOP_OPACITY = 0.3;

/** The selected range and its bins, as the activity requests take them. */
function useServerEvaluationActivityVariables() {
  const timeRange = useClosedTimeRange();
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const variables = {
    timeRange: {
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString(),
    },
    timeBinConfig: { scale, utcOffsetMinutes },
  };
  return { timeRange, scale, variables };
}

/**
 * The server's evaluation activity over the selected range, grouped by
 * project, with the evaluations in the queue now. The charts and the queue
 * strip's cost read the same request.
 */
export function useServerEvaluationActivity({
  fetchKey,
}: {
  fetchKey: string;
}) {
  const { timeRange, scale, variables } =
    useServerEvaluationActivityVariables();
  const data = useLazyLoadQuery<ServerEvaluationChartsQuery>(
    graphql`
      query ServerEvaluationChartsQuery(
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        evaluationQueue {
          queuedCount
        }
        evaluationActivity(
          timeRange: $timeRange
          timeBinConfig: $timeBinConfig
        ) {
          evaluatedCount
          failedCount
          cost
          excludesUntracedEvaluators
          groups {
            project {
              id
              name
            }
            evaluatedCount
            failedCount
            cost
            evaluationSeconds
          }
          series {
            timestamp
            groups {
              project {
                id
              }
              evaluatedCount
              failedCount
              addedCount
              lagP95Seconds
            }
          }
        }
      }
    `,
    variables,
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  return { data, timeRange, scale, variables };
}

type QueueSizeVariables = ReturnType<
  typeof useServerEvaluationActivityVariables
>["variables"] & { fetchKey: string };

/**
 * The evaluations in queue at each bin's end, keyed by the bin's start. A
 * request of its own, so the other charts don't wait on it: it reads every
 * evaluation in queue. It shares the activity request's bins in the Relay
 * store, which is safe because it only adds a value to each bin.
 */
function useQueueSizeByTimestamp({
  fetchKey,
  timeRange,
  timeBinConfig,
}: QueueSizeVariables): Map<number, number> {
  const data = useLazyLoadQuery<ServerEvaluationQueueSizeChartQuery>(
    graphql`
      query ServerEvaluationQueueSizeChartQuery(
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
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
    `,
    { timeRange, timeBinConfig },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  return new Map(
    data.evaluationActivity.series.map((bin) => [
      new Date(bin.timestamp).getTime(),
      bin.queueSize,
    ])
  );
}

/**
 * Starts the queue size request beside the activity request. The charts read
 * queue size only once activity has loaded, so without this the two requests
 * run one after the other. Renders nothing: the charts read the same request.
 */
function QueueSizePreload({ fetchKey }: { fetchKey: string }) {
  const { variables } = useServerEvaluationActivityVariables();
  useQueueSizeByTimestamp({ ...variables, fetchKey });
  return null;
}

/** A project series' color: the next palette color by rank, gray for the rest. */
function useProjectSeriesColor() {
  const colors = useCategoryChartColors();
  const grayscaleColors = useGrayscaleCategoricalColors();
  return ({ colorIndex }: ProjectSeries) =>
    colorIndex == null
      ? grayscaleColors.gray3
      : getCategoryChartColor({ index: colorIndex, colors });
}

/**
 * The selected charts above the table, in a resizable panel that the table
 * content fills below. With no chart selected, the content takes the space.
 */
export function ServerEvaluationChartsPanelGroup({
  fetchKey,
  children,
}: {
  /** From the page's queue stats poll. */
  fetchKey: string;
  children: ReactNode;
}) {
  const chartKeys = usePreferencesContext(
    (state) => state.serverEvaluationChartKeys
  );
  const charts = getServerEvaluationCharts(chartKeys);
  const hasCharts = charts.length > 0;
  const readsQueueSize = charts.some((chart) => chart.readsQueueSize);
  const { timeRangeISOStrings } = useTimeRange();
  // Retry after an error once the page refetches or the range changes.
  const errorResetKey = `${fetchKey} ${timeRangeISOStrings.start} ${timeRangeISOStrings.end}`;
  const chartsLayout = useMetricChartsLayout({
    id: "server-evaluations-metrics-layout",
    isChartsPanelShown: hasCharts,
  });
  return (
    <Group orientation="vertical" {...chartsLayout}>
      {hasCharts && (
        <MetricChartsPanel>
          <View
            paddingStart="size-200"
            paddingEnd="size-200"
            paddingTop="size-100"
            height="100%"
          >
            <ErrorBoundary
              resetKey={errorResetKey}
              fallback={() => (
                <Alert variant="danger">Couldn't load the charts</Alert>
              )}
            >
              <Suspense fallback={<ChartPanelStripSkeleton />}>
                <ServerEvaluationCharts fetchKey={fetchKey} charts={charts} />
              </Suspense>
            </ErrorBoundary>
            {readsQueueSize && (
              // The charts that read queue size show and report its errors.
              <ErrorBoundary
                resetKey={errorResetKey}
                fallback={() => null}
                isExpectedError={() => true}
              >
                <Suspense fallback={null}>
                  <QueueSizePreload fetchKey={fetchKey} />
                </Suspense>
              </ErrorBoundary>
            )}
          </View>
        </MetricChartsPanel>
      )}
      <Panel id={METRIC_CHARTS_CONTENT_PANEL_ID}>{children}</Panel>
    </Group>
  );
}

/** The "Charts" button that picks which charts the page shows, and in what order. */
export function ServerEvaluationChartsSelector() {
  const chartKeys = usePreferencesContext(
    (state) => state.serverEvaluationChartKeys
  );
  const setChartKeys = usePreferencesContext(
    (state) => state.setServerEvaluationChartKeys
  );
  return (
    <MenuTrigger>
      <Button aria-label="Select metric charts">
        <Flex direction="row" alignItems="center" gap="size-100">
          <Icon svg={<Icons.BarChart />} />
          Charts
        </Flex>
      </Button>
      <MenuContainer placement="bottom end">
        <MetricsChartSelector
          options={SERVER_EVALUATION_CHARTS}
          selectedKeys={getServerEvaluationCharts(chartKeys).map(
            (chart) => chart.key
          )}
          onSelectionChange={setChartKeys}
        />
      </MenuContainer>
    </MenuTrigger>
  );
}

/**
 * Charts of the shared queue over the selected range: how fast it filled and
 * drained, how big it was, each project's lag, and what each project used.
 */
function ServerEvaluationCharts({
  fetchKey,
  charts,
}: {
  fetchKey: string;
  charts: ServerEvaluationChart[];
}) {
  const { data, timeRange, scale, variables } = useServerEvaluationActivity({
    fetchKey,
  });
  const projectSeries = getServerProjectSeries(data.evaluationActivity.groups);
  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const xAxisProps: XAxisOverrides = {
    ...compactTimeXAxisProps,
    domain: [timeRange.start.getTime(), timeRange.end.getTime()],
    tickFormatter: (x: number) => timeTickFormatter(new Date(x)),
  };
  const context: ChartContext = {
    data,
    projectSeries,
    xAxisProps,
    queueSizeVariables: { ...variables, fetchKey },
  };
  return (
    <ChartPanelStrip chartCount={charts.length}>
      {charts.map((chart) => (
        <ServerEvaluationChartPanel
          key={chart.key}
          chart={chart}
          context={context}
        />
      ))}
    </ChartPanelStrip>
  );
}

type XAxisOverrides = {
  domain: number[];
  tickFormatter: (x: number) => string;
};

type ChartContext = {
  data: ActivityData;
  projectSeries: ServerProjectSeries;
  xAxisProps: XAxisOverrides;
  queueSizeVariables: QueueSizeVariables;
};

function ServerEvaluationChartPanel({
  chart,
  context,
}: {
  chart: ServerEvaluationChart;
  context: ChartContext;
}) {
  const { data, projectSeries, xAxisProps, queueSizeVariables } = context;
  const activity = data.evaluationActivity;
  const panel = (subtitle: string | undefined, content: ReactNode) => (
    <ChartPanel
      title={chart.name}
      subtitle={subtitle}
      help={chart.help}
      fillHeight
    >
      {content}
    </ChartPanel>
  );
  const untracedSubtitle = activity.excludesUntracedEvaluators
    ? "Excludes evaluators with tracing off"
    : undefined;
  const key: ServerEvaluationChartKey = chart.key;
  switch (key) {
    case "queueThroughput":
      return panel(
        formatQueueGrowthSummary(getTotalNet(activity.series)),
        <QueueThroughputChart
          activity={activity}
          xAxisProps={xAxisProps}
          queueSizeVariables={queueSizeVariables}
        />
      );
    case "queueSize":
      return panel(
        `${intShortFormatter(data.evaluationQueue.queuedCount)} in queue now`,
        <QueueSizeChart
          activity={activity}
          xAxisProps={xAxisProps}
          queueSizeVariables={queueSizeVariables}
        />
      );
    case "lagByProject":
      return panel(
        undefined,
        <LagByProjectChart
          activity={activity}
          projectSeries={projectSeries}
          xAxisProps={xAxisProps}
        />
      );
    case "evaluationsByProject":
      return panel(
        undefined,
        <ProjectTotalsChart
          activity={activity}
          projectSeries={projectSeries}
          getValue={(group) => group.evaluatedCount + group.failedCount}
          format={intFormatter}
          formatShort={intShortFormatter}
          valueName="Evaluations"
        />
      );
    case "costByProject":
      return panel(
        untracedSubtitle,
        <ProjectTotalsChart
          activity={activity}
          projectSeries={projectSeries}
          getValue={(group) => group.cost ?? 0}
          format={costFormatter}
          formatShort={costFormatter}
          valueName="Cost"
        />
      );
    case "evaluationTimeByProject":
      return panel(
        untracedSubtitle,
        <ProjectTotalsChart
          activity={activity}
          projectSeries={projectSeries}
          getValue={(group) => group.evaluationSeconds ?? 0}
          format={formatLag}
          formatShort={formatLag}
          valueName="Evaluation time"
        />
      );
    default:
      return assertUnreachable(key);
  }
}

function TimeTooltipContent({
  active,
  payload,
  label,
  formatValue = intFormatter,
}: TooltipContentProps & { formatValue?: (value: number) => string }) {
  const { fullTimeFormatter } = useTimeFormatters();
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  return (
    <ChartTooltip>
      {label != null ? (
        <Text weight="heavy" size="S">
          {fullTimeFormatter(new Date(Number(label)))}
        </Text>
      ) : null}
      {payload.map((entry) =>
        entry.value == null ? null : (
          <ChartTooltipItem
            key={String(entry.dataKey)}
            color={entry.color ?? "transparent"}
            shape="circle"
            name={String(entry.name ?? entry.dataKey)}
            value={formatValue(Number(entry.value))}
          />
        )
      )}
    </ChartTooltip>
  );
}

function LagTooltipContent(props: TooltipContentProps) {
  return <TimeTooltipContent {...props} formatValue={formatLag} />;
}

type QueueThroughputRow = {
  timestamp: number;
  added: number;
  /** Completed, negated so its bar hangs below the line. */
  completedBelow: number;
  completed: number;
  queueSize: number;
};

function formatSignedCount(value: number): string {
  return value > 0 ? `+${intFormatter(value)}` : intFormatter(value);
}

function QueueThroughputTooltipContent({
  active,
  payload,
  label,
  addedColor,
  completedColor,
  queueSizeColor,
}: TooltipContentProps & {
  addedColor: string;
  completedColor: string;
  queueSizeColor: string;
}) {
  const { fullTimeFormatter } = useTimeFormatters();
  const semanticColors = useSemanticChartColors();
  const grayscaleColors = useGrayscaleCategoricalColors();
  const row = payload?.[0]?.payload as QueueThroughputRow | undefined;
  if (!active || row == null) {
    return null;
  }
  const net = row.added - row.completed;
  const netItem =
    net > 0
      ? { name: "Falling behind", color: semanticColors.danger }
      : net < 0
        ? { name: "Catching up", color: semanticColors.success }
        : { name: "Keeping pace", color: grayscaleColors.gray3 };
  return (
    <ChartTooltip>
      {label != null ? (
        <Text weight="heavy" size="S">
          {fullTimeFormatter(new Date(Number(label)))}
        </Text>
      ) : null}
      <ChartTooltipItem
        color={addedColor}
        shape="square"
        name="Added"
        value={intFormatter(row.added)}
      />
      <ChartTooltipItem
        color={completedColor}
        shape="square"
        name="Completed"
        value={intFormatter(row.completed)}
      />
      <ChartTooltipDivider />
      <ChartTooltipItem
        color={netItem.color}
        shape="square"
        name={netItem.name}
        value={formatSignedCount(net)}
      />
      <ChartTooltipItem
        color={queueSizeColor}
        shape="line"
        name="Queue size"
        value={intFormatter(row.queueSize)}
      />
    </ChartTooltip>
  );
}

/**
 * Added and completed evaluations mirrored around the line: added above,
 * completed below, so a bin where the queue fell behind has the taller bar
 * on top.
 */
function QueueThroughputChart({
  activity,
  xAxisProps,
  queueSizeVariables,
}: {
  activity: Activity;
  xAxisProps: XAxisOverrides;
  queueSizeVariables: QueueSizeVariables;
}) {
  const queueSizeByTimestamp = useQueueSizeByTimestamp(queueSizeVariables);
  const grayscaleColors = useGrayscaleCategoricalColors();
  const sequentialColors = useSequentialChartColors();
  const addedColor = grayscaleColors.gray1;
  const completedColor = grayscaleColors.gray3;
  const rows: QueueThroughputRow[] = activity.series.map((bin) => {
    const timestamp = new Date(bin.timestamp).getTime();
    const completed = getCompletedCount(bin);
    return {
      timestamp,
      added: getAddedCount(bin),
      completedBelow: -completed,
      completed,
      queueSize: queueSizeByTimestamp.get(timestamp) ?? 0,
    };
  });
  const hasData = rows.some((row) => row.added > 0 || row.completed > 0);
  const { extent, ticks } = getMirroredCountAxis(
    Math.max(0, ...rows.map((row) => Math.max(row.added, row.completed)))
  );
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasData}
      message="No evaluations in this time range"
      chartType="bar"
    >
      <ChartResponsiveContainer>
        <BarChart
          data={rows}
          margin={compactChartMargin}
          maxBarSize={8}
          stackOffset="sign"
        >
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis {...xAxisProps} />
          <YAxis
            {...compactYAxisProps}
            domain={[-extent, extent]}
            ticks={ticks}
            tickFormatter={(y: number) => intShortFormatter(Math.abs(y))}
          />
          <Tooltip
            content={(props: TooltipContentProps) => (
              <QueueThroughputTooltipContent
                {...props}
                addedColor={addedColor}
                completedColor={completedColor}
                queueSizeColor={sequentialColors.blue500}
              />
            )}
            {...defaultTooltipProps}
          />
          <ReferenceLine y={0} stroke="var(--chart-axis-stroke-color)" />
          <Bar
            dataKey="added"
            name="Added, above the line"
            stackId="throughput"
            fill={addedColor}
            hide={isDataKeyHidden("added")}
            isAnimationActive={false}
          />
          <Bar
            dataKey="completedBelow"
            name="Completed, below the line"
            stackId="throughput"
            fill={completedColor}
            hide={isDataKeyHidden("completedBelow")}
            isAnimationActive={false}
          />
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconType="square"
            iconSize={8}
            itemSorter={null}
            onToggleDataKey={toggleDataKey}
          />
        </BarChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}

/**
 * The evaluations in queue at each bin's end, as a filled line, with how
 * many evaluations were processed in each bin.
 */
function QueueSizeChart({
  activity,
  xAxisProps,
  queueSizeVariables,
}: {
  activity: Activity;
  xAxisProps: XAxisOverrides;
  queueSizeVariables: QueueSizeVariables;
}) {
  const queueSizeByTimestamp = useQueueSizeByTimestamp(queueSizeVariables);
  const sequentialColors = useSequentialChartColors();
  const grayscaleColors = useGrayscaleCategoricalColors();
  const queueSizeColor = sequentialColors.blue500;
  const processedColor = grayscaleColors.gray1;
  const gradientId = useId();
  const chartData = activity.series.map((bin) => {
    const timestamp = new Date(bin.timestamp).getTime();
    return {
      timestamp,
      queueSize: queueSizeByTimestamp.get(timestamp) ?? 0,
      processed: getCompletedCount(bin),
    };
  });
  const hasData = chartData.some(
    (datum) => datum.queueSize > 0 || datum.processed > 0
  );
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasData}
      message="Nothing in queue in this time range"
      chartType="line"
    >
      <ChartResponsiveContainer>
        <ComposedChart data={chartData} margin={compactChartMargin}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0"
                stopColor={queueSizeColor}
                stopOpacity={AREA_FILL_TOP_OPACITY}
              />
              <stop offset="1" stopColor={queueSizeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis {...xAxisProps} />
          <YAxis
            {...compactYAxisProps}
            tickFormatter={(y: number) => intShortFormatter(y)}
          />
          <Tooltip content={TimeTooltipContent} {...defaultTooltipProps} />
          <Area
            type="monotone"
            dataKey="queueSize"
            name="In queue"
            stroke={queueSizeColor}
            fill={`url(#${gradientId})`}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4 }}
            hide={isDataKeyHidden("queueSize")}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="processed"
            name="Processed"
            stroke={processedColor}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4 }}
            hide={isDataKeyHidden("processed")}
            isAnimationActive={false}
          />
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconType="circle"
            iconSize={8}
            itemSorter={null}
            onToggleDataKey={toggleDataKey}
          />
        </ComposedChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}

/**
 * One chart row per bin with a value per series. A series that folds several
 * projects together takes the slowest one's p95, an upper bound on theirs,
 * and stays null where nothing finished.
 */
function getLagRows({
  activity,
  projectSeries,
}: {
  activity: Activity;
  projectSeries: ServerProjectSeries;
}): Array<Record<string, number | null>> {
  const { series, getKey } = projectSeries;
  return activity.series.map((bin) => {
    const datum: Record<string, number | null> = {
      timestamp: new Date(bin.timestamp).getTime(),
    };
    for (const { key } of series) {
      datum[key] = null;
    }
    for (const group of bin.groups) {
      if (group.lagP95Seconds == null) {
        continue;
      }
      const key = getKey(group.project.id);
      datum[key] = Math.max(datum[key] ?? 0, group.lagP95Seconds);
    }
    return datum;
  });
}

function getLegendDataKey(entry: LegendPayload): string | null {
  return typeof entry.dataKey === "string" ? entry.dataKey : null;
}

function LagByProjectChart({
  activity,
  projectSeries,
  xAxisProps,
}: {
  activity: Activity;
  projectSeries: ServerProjectSeries;
  xAxisProps: XAxisOverrides;
}) {
  const getColor = useProjectSeriesColor();
  const { series } = projectSeries;
  const chartData = getLagRows({ activity, projectSeries });
  const lags = chartData.flatMap((datum) =>
    series.flatMap(({ key }) => (datum[key] != null ? [datum[key]] : []))
  );
  const ticks = getDurationTicks(Math.max(0, ...lags));
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  // Hovering a project in the legend brings its line forward.
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  return (
    <ChartEmptyStateOverlay
      isEmpty={lags.length === 0}
      message="No completed evaluations in this time range"
      chartType="line"
    >
      <ChartResponsiveContainer>
        <LineChart data={chartData} margin={compactChartMargin}>
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis {...xAxisProps} />
          <YAxis
            {...compactYAxisProps}
            tickFormatter={formatLag}
            ticks={ticks}
            domain={[0, ticks[ticks.length - 1]]}
          />
          <Tooltip content={LagTooltipContent} {...defaultTooltipProps} />
          {series.map((entry) => {
            const { key, name } = entry;
            const isDimmed = highlightedKey != null && highlightedKey !== key;
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={name}
                stroke={getColor(entry)}
                strokeWidth={highlightedKey === key ? 2.5 : 1.5}
                strokeOpacity={isDimmed ? 0.2 : 1}
                // A bin where nothing finished has no lag; bridge it so each
                // project reads as one line.
                connectNulls
                dot={false}
                activeDot={{ r: 4 }}
                hide={isDataKeyHidden(key)}
                isAnimationActive={false}
              />
            );
          })}
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconType="circle"
            iconSize={8}
            itemSorter={null}
            onToggleDataKey={toggleDataKey}
            onMouseEnter={(entry) => setHighlightedKey(getLegendDataKey(entry))}
            onMouseLeave={() => setHighlightedKey(null)}
          />
        </LineChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}

type ProjectTotalRow = {
  key: string;
  name: string;
  color: string;
  value: number;
  /** The row's part of the total, from 0 to 1. */
  share: number;
};

/** Each project series' total, largest first, then the other projects. */
function getProjectTotalRows({
  activity,
  projectSeries,
  getValue,
  getColor,
}: {
  activity: Activity;
  projectSeries: ServerProjectSeries;
  getValue: (group: Activity["groups"][number]) => number;
  getColor: (series: ProjectSeries) => string;
}): ProjectTotalRow[] {
  const { series, getKey } = projectSeries;
  const totals = new Map<string, number>();
  for (const group of activity.groups) {
    const key = getKey(group.project.id);
    totals.set(key, (totals.get(key) ?? 0) + getValue(group));
  }
  const rows = series
    .map((entry) => ({
      key: entry.key,
      name: entry.name,
      color: getColor(entry),
      value: totals.get(entry.key) ?? 0,
    }))
    .filter((row) => row.value > 0)
    .sort(
      (a, b) =>
        Number(a.key === OTHER_PROJECTS_KEY) -
          Number(b.key === OTHER_PROJECTS_KEY) || b.value - a.value
    );
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows.map((row) => ({
    ...row,
    share: total > 0 ? row.value / total : 0,
  }));
}

const shareFormatter = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 0,
});

/** Room for the longest project names the axis shows before truncating. */
const PROJECT_AXIS_WIDTH = 112;
const PROJECT_AXIS_MAX_CHARS = 16;

function truncateProjectName(name: string): string {
  return name.length > PROJECT_AXIS_MAX_CHARS
    ? `${name.slice(0, PROJECT_AXIS_MAX_CHARS - 1)}…`
    : name;
}

function ProjectTotalTooltipContent({
  active,
  payload,
  formatValue,
}: TooltipContentProps & { formatValue: (value: number) => string }) {
  const row = payload?.[0]?.payload as ProjectTotalRow | undefined;
  if (!active || row == null) {
    return null;
  }
  return (
    <ChartTooltip>
      <ChartTooltipItem
        color={row.color}
        shape="circle"
        name={row.name}
        value={formatValue(row.value)}
      />
      <Text size="S" color="text-700">
        {`${shareFormatter.format(row.share)} of the total`}
      </Text>
    </ChartTooltip>
  );
}

/** A horizontal bar per project series with its total over the range. */
function ProjectTotalsChart({
  activity,
  projectSeries,
  getValue,
  format,
  formatShort,
  valueName,
}: {
  activity: Activity;
  projectSeries: ServerProjectSeries;
  getValue: (group: Activity["groups"][number]) => number;
  format: (value: number) => string;
  formatShort: (value: number) => string;
  valueName: string;
}) {
  const getColor = useProjectSeriesColor();
  const rows = getProjectTotalRows({
    activity,
    projectSeries,
    getValue,
    getColor,
  });
  return (
    <ChartEmptyStateOverlay
      isEmpty={rows.length === 0}
      message="Nothing to show in this time range"
      chartType="barHorizontal"
    >
      <ChartResponsiveContainer>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ ...compactChartMargin, right: 56 }}
          barSize={10}
        >
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            {...defaultYAxisProps}
            type="category"
            dataKey="name"
            width={PROJECT_AXIS_WIDTH}
            axisLine={false}
            tickLine={false}
            tickMargin={4}
            interval={0}
            tickFormatter={truncateProjectName}
          />
          <Tooltip
            content={(props: TooltipContentProps) => (
              <ProjectTotalTooltipContent {...props} formatValue={format} />
            )}
            {...defaultTooltipProps}
          />
          <Bar
            dataKey="value"
            name={valueName}
            radius={2}
            isAnimationActive={false}
          >
            {rows.map((row) => (
              <Cell key={row.key} fill={row.color} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(value) => formatShort(Number(value))}
              fill="var(--chart-axis-text-color)"
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
