import { type ReactNode, Suspense, useState } from "react";
import { graphql, useFragment, useLazyLoadQuery } from "react-relay";
import { Group, Panel } from "react-resizable-panels";
import type { LegendPayload, TooltipContentProps } from "recharts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import invariant from "tiny-invariant";

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
} from "@phoenix/components/chart";
import {
  useTimeRange,
  useTimeRangeSelectionKey,
} from "@phoenix/components/datetime";
import { ErrorBoundary } from "@phoenix/components/exception";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import type { ServerEvaluationCharts_queueSize$key } from "@phoenix/pages/evaluators/project-evaluators/__generated__/ServerEvaluationCharts_queueSize.graphql";
import type {
  ServerEvaluationChartsQuery,
  ServerEvaluationChartsQuery$data,
} from "@phoenix/pages/evaluators/project-evaluators/__generated__/ServerEvaluationChartsQuery.graphql";
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
import {
  QueueSizeChart,
  QueueThroughputChart,
  TimeTooltipContent,
} from "@phoenix/pages/project/metrics/EvaluationQueueCharts";
import { getDurationTicks } from "@phoenix/pages/project/metrics/evaluatorActivity";
import {
  formatQueueGrowthSummary,
  getQueueSizeRows,
  getQueueThroughputRows,
  getTotalNet,
} from "@phoenix/pages/project/metrics/queueThroughput";
import { useClosedTimeRange } from "@phoenix/pages/project/metrics/useClosedTimeRange";
import { assertUnreachable } from "@phoenix/typeUtils";
import {
  costFormatter,
  intFormatter,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

type ActivityData = ServerEvaluationChartsQuery$data;
type Activity = ActivityData["evaluationActivity"];

/**
 * The server's evaluation activity over the selected range, grouped by
 * project, with the evaluations in the queue now. The charts and the queue
 * strip's cost read the same request. When a selected chart reads the queue
 * size, it arrives in a deferred part of the response, so the other charts
 * don't wait on it: it reads every evaluation in queue.
 */
export function useServerEvaluationActivity({
  fetchKey,
}: {
  fetchKey: string;
}) {
  const timeRange = useClosedTimeRange();
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const chartKeys = usePreferencesContext(
    (state) => state.serverEvaluationChartKeys
  );
  const includeQueueSize = getServerEvaluationCharts(chartKeys).some(
    (chart) => chart.readsQueueSize
  );
  const data = useLazyLoadQuery<ServerEvaluationChartsQuery>(
    graphql`
      query ServerEvaluationChartsQuery(
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
        $includeQueueSize: Boolean!
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
        ...ServerEvaluationCharts_queueSize
          @defer
          @arguments(
            timeRange: $timeRange
            timeBinConfig: $timeBinConfig
            includeQueueSize: $includeQueueSize
          )
      }
    `,
    {
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
      timeBinConfig: { scale, utcOffsetMinutes },
      includeQueueSize,
    },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  return { data, timeRange, scale };
}

/**
 * The evaluations in queue at each bin's end, keyed by the bin's start.
 * Suspends until the deferred part of the activity response arrives.
 */
function useQueueSizeByTimestamp(
  queueSizeRef: ServerEvaluationCharts_queueSize$key
): Map<number, number> {
  const { queueSizeActivity } = useFragment(
    graphql`
      fragment ServerEvaluationCharts_queueSize on Query
      @argumentDefinitions(
        timeRange: { type: "TimeRange!" }
        timeBinConfig: { type: "TimeBinConfig!" }
        includeQueueSize: { type: "Boolean!" }
      ) {
        # Aliased so the server resolves it apart from the activity above and
        # reads only the queue size, instead of merging the two selections.
        # The Relay store keeps both on the same records, which is safe
        # because this only adds a value to each bin.
        queueSizeActivity: evaluationActivity(
          timeRange: $timeRange
          timeBinConfig: $timeBinConfig
        ) @include(if: $includeQueueSize) {
          series {
            timestamp
            # A failed deferred part leaves it unset, and Relay only logs the
            # error, so throw instead of drawing an empty queue.
            queueSize @required(action: THROW)
          }
        }
      }
    `,
    queueSizeRef
  );
  invariant(
    queueSizeActivity != null,
    "Queue size is read only by charts that request it"
  );
  return new Map(
    queueSizeActivity.series.map((bin) => [
      new Date(bin.timestamp).getTime(),
      bin.queueSize,
    ])
  );
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
  const { timeRangeISOStrings } = useTimeRange();
  const timeRangeSelectionKey = useTimeRangeSelectionKey();
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
            {/* Retries after an error once the page refetches or the range changes. */}
            <ErrorBoundary
              resetKey={`${fetchKey} ${timeRangeISOStrings.start} ${timeRangeISOStrings.end}`}
              fallback={() => (
                <Alert variant="danger">Couldn't load the charts</Alert>
              )}
            >
              <Suspense
                key={timeRangeSelectionKey}
                fallback={<ServerEvaluationChartsSkeleton charts={charts} />}
              >
                <ServerEvaluationCharts fetchKey={fetchKey} charts={charts} />
              </Suspense>
            </ErrorBoundary>
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
  const { data, timeRange, scale } = useServerEvaluationActivity({
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
    queueSizeRef: data,
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

/** The selected charts' panels while their data loads. */
function ServerEvaluationChartsSkeleton({
  charts,
}: {
  charts: ServerEvaluationChart[];
}) {
  return (
    <ChartPanelStrip chartCount={charts.length}>
      {charts.map((chart) => (
        <ChartPanel
          key={chart.key}
          title={chart.name}
          help={chart.help}
          fillHeight
        >
          <ChartSkeleton />
        </ChartPanel>
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
  queueSizeRef: ServerEvaluationCharts_queueSize$key;
};

function ServerEvaluationChartPanel({
  chart,
  context,
}: {
  chart: ServerEvaluationChart;
  context: ChartContext;
}) {
  const { data, projectSeries, xAxisProps, queueSizeRef } = context;
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
        <ServerQueueThroughputChart
          activity={activity}
          xAxisProps={xAxisProps}
          queueSizeRef={queueSizeRef}
        />
      );
    case "queueSize":
      return panel(
        `${intShortFormatter(data.evaluationQueue.queuedCount)} in queue now`,
        <ServerQueueSizeChart
          activity={activity}
          xAxisProps={xAxisProps}
          queueSizeRef={queueSizeRef}
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
          getValue={(group) => group.evaluatedCount + group.failedCount || null}
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
          getValue={(group) => group.cost}
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
          getValue={(group) => group.evaluationSeconds}
          format={formatLag}
          formatShort={formatLag}
          valueName="Evaluation time"
        />
      );
    default:
      return assertUnreachable(key);
  }
}

function LagTooltipContent(props: TooltipContentProps) {
  return <TimeTooltipContent {...props} formatValue={formatLag} />;
}

/** The server's throughput chart, with the queue size from the deferred part. */
function ServerQueueThroughputChart({
  activity,
  xAxisProps,
  queueSizeRef,
}: {
  activity: Activity;
  xAxisProps: XAxisOverrides;
  queueSizeRef: ServerEvaluationCharts_queueSize$key;
}) {
  const queueSizeByTimestamp = useQueueSizeByTimestamp(queueSizeRef);
  const rows = getQueueThroughputRows({
    bins: activity.series,
    queueSizeByTimestamp,
  });
  return <QueueThroughputChart rows={rows} xAxis={xAxisProps} />;
}

/** The server's queue size chart, from the deferred part of the request. */
function ServerQueueSizeChart({
  activity,
  xAxisProps,
  queueSizeRef,
}: {
  activity: Activity;
  xAxisProps: XAxisOverrides;
  queueSizeRef: ServerEvaluationCharts_queueSize$key;
}) {
  const queueSizeByTimestamp = useQueueSizeByTimestamp(queueSizeRef);
  const rows = getQueueSizeRows({
    bins: activity.series,
    queueSizeByTimestamp,
  });
  return <QueueSizeChart rows={rows} xAxis={xAxisProps} />;
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

/**
 * Each project series' total, largest first, then the other projects. A
 * series with no value recorded, such as no cost, has no row; one that
 * recorded 0 does.
 */
function getProjectTotalRows({
  activity,
  projectSeries,
  getValue,
  getColor,
}: {
  activity: Activity;
  projectSeries: ServerProjectSeries;
  getValue: (group: Activity["groups"][number]) => number | null;
  getColor: (series: ProjectSeries) => string;
}): ProjectTotalRow[] {
  const { series, getKey } = projectSeries;
  const totals = new Map<string, number>();
  for (const group of activity.groups) {
    const value = getValue(group);
    if (value == null) {
      continue;
    }
    const key = getKey(group.project.id);
    totals.set(key, (totals.get(key) ?? 0) + value);
  }
  const rows = series
    .flatMap((entry) => {
      const value = totals.get(entry.key);
      return value == null
        ? []
        : [
            {
              key: entry.key,
              name: entry.name,
              color: getColor(entry),
              value,
            },
          ];
    })
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
  /** A group's value, or null where it recorded none. */
  getValue: (group: Activity["groups"][number]) => number | null;
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
          <XAxis
            type="number"
            hide
            domain={[0, (dataMax: number) => (dataMax > 0 ? dataMax : 1)]}
          />
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
            minPointSize={2}
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
