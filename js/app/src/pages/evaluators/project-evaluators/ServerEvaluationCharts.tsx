import { css } from "@emotion/react";
import { useEffect, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import type { TooltipContentProps } from "recharts";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Flex,
  Text,
  ToggleButton,
  ToggleButtonGroup,
  Truncate,
  View,
} from "@phoenix/components";
import {
  CHART_PANEL_STRIP_DEFAULT_HEIGHT_PIXELS,
  ChartEmptyStateOverlay,
  ChartPanel,
  ChartPanelStrip,
  ChartPanelStripSkeleton,
  ChartResponsiveContainer,
  ChartTooltip,
  ChartTooltipItem,
  compactChartMargin,
  compactLegendProps,
  compactTimeXAxisProps,
  compactYAxisProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  InteractiveLegend,
  useBinTimeTickFormatter,
  useCategoryChartColors,
  useInteractiveLegend,
  useSemanticChartColors,
} from "@phoenix/components/chart";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import type {
  ServerEvaluationChartsQuery,
  ServerEvaluationChartsQuery$data,
} from "@phoenix/pages/evaluators/project-evaluators/__generated__/ServerEvaluationChartsQuery.graphql";
import type { ServerEvaluationQueueSizeChartQuery } from "@phoenix/pages/evaluators/project-evaluators/__generated__/ServerEvaluationQueueSizeChartQuery.graphql";
import type {
  ProjectSeries,
  ServerProjectSeries,
} from "@phoenix/pages/evaluators/project-evaluators/serverProjectSeries";
import {
  getServerProjectSeries,
  OTHER_PROJECTS_KEY,
} from "@phoenix/pages/evaluators/project-evaluators/serverProjectSeries";
import { LAG_WARNING_SECONDS } from "@phoenix/pages/project/evaluators/evaluationQueueStatParts";
import { formatLag } from "@phoenix/pages/project/evaluators/projectEvaluatorFormat";
import { getDurationTicks } from "@phoenix/pages/project/metrics/evaluatorActivity";
import { useClosedTimeRange } from "@phoenix/pages/project/metrics/useClosedTimeRange";
import {
  costFormatter,
  intFormatter,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

type Activity = ServerEvaluationChartsQuery$data["evaluationActivity"];

const OTHER_PROJECTS_COLOR = "var(--global-color-gray-600)";

/** Added work reads as neutral, so completed work stands out beside it. */
const ADDED_COLOR = "var(--global-color-gray-500)";

/**
 * The server's evaluation activity over the selected range, grouped by
 * project, with each project's evaluations in the queue now. The charts, the
 * queue strip's cost, and the project picker read the same request.
 */
export function useServerEvaluationActivity({
  fetchKey,
  fetchPolicy = "store-and-network",
}: {
  fetchKey: string;
  fetchPolicy?: "store-and-network" | "store-or-network";
}) {
  const timeRange = useClosedTimeRange();
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const data = useLazyLoadQuery<ServerEvaluationChartsQuery>(
    graphql`
      query ServerEvaluationChartsQuery(
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        evaluationQueue {
          queuedCount
          projects(first: 1000) {
            project {
              id
            }
            queuedCount
          }
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
    {
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
      timeBinConfig: { scale, utcOffsetMinutes },
    },
    { fetchKey, fetchPolicy }
  );
  return { data, timeRange, scale, utcOffsetMinutes };
}

/**
 * Which projects get their own series and color in the strip's charts and the
 * project picker; see {@link getServerProjectSeries}.
 */
export function useServerProjectSeries(
  data: ServerEvaluationChartsQuery$data,
  pickedProjectIds: ReadonlyArray<string>
): ServerProjectSeries {
  const colors = useCategoryChartColors();
  return getServerProjectSeries({
    groups: data.evaluationActivity.groups,
    queued: data.evaluationQueue.projects,
    pickedProjectIds,
    palette: [
      colors.category1,
      colors.category2,
      colors.category3,
      colors.category4,
      colors.category5,
      colors.category6,
      colors.category7,
      colors.category8,
      colors.category9,
      colors.category10,
      colors.category11,
      colors.category12,
    ],
    otherColor: OTHER_PROJECTS_COLOR,
  });
}

/**
 * Charts of the shared queue over the selected range: each project's lag or
 * queue size, what was added and completed, and which projects used it most.
 */
export function ServerEvaluationCharts({
  fetchKey,
  pickedProjectIds,
  onPickedProjectIdsChange,
}: {
  /** From the page's queue stats poll. */
  fetchKey: string;
  /** Projects picked to show on their own; none shows the heaviest few. */
  pickedProjectIds: ReadonlyArray<string>;
  /** Called to drop picks that no longer name a project with an evaluator. */
  onPickedProjectIdsChange: (projectIds: string[]) => void;
}) {
  const { data, timeRange, scale, utcOffsetMinutes } =
    useServerEvaluationActivity({ fetchKey });
  const activity = data.evaluationActivity;
  const projectSeries = useServerProjectSeries(data, pickedProjectIds);
  const hasStalePicks =
    projectSeries.pickedIds.length !== pickedProjectIds.length;
  useEffect(() => {
    if (hasStalePicks) {
      onPickedProjectIdsChange(projectSeries.pickedIds);
    }
  }, [hasStalePicks, onPickedProjectIdsChange, projectSeries.pickedIds]);
  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const xAxisProps = {
    ...compactTimeXAxisProps,
    domain: [timeRange.start.getTime(), timeRange.end.getTime()],
    tickFormatter: (x: number) => timeTickFormatter(new Date(x)),
  };
  return (
    <View
      paddingX="size-200"
      paddingTop="size-100"
      height={CHART_PANEL_STRIP_DEFAULT_HEIGHT_PIXELS}
      flex="none"
    >
      <ChartPanelStrip chartCount={3}>
        <ByProjectPanel
          activity={activity}
          projectSeries={projectSeries}
          xAxisProps={xAxisProps}
          queueSizeVariables={{
            fetchKey,
            timeRange: {
              start: timeRange.start.toISOString(),
              end: timeRange.end.toISOString(),
            },
            timeBinConfig: { scale, utcOffsetMinutes },
          }}
        />
        <ChartPanel title="Added vs completed" fillHeight>
          <AddedVsCompletedChart
            activity={activity}
            projectSeries={projectSeries}
            xAxisProps={xAxisProps}
          />
        </ChartPanel>
        <TopProjectsPanel activity={activity} projectSeries={projectSeries} />
      </ChartPanelStrip>
    </View>
  );
}

/**
 * The charts while they load: the chart strip skeleton, at the height of the
 * loaded strip.
 */
export function ServerEvaluationChartsSkeleton() {
  return (
    <View height={CHART_PANEL_STRIP_DEFAULT_HEIGHT_PIXELS} flex="none">
      <ChartPanelStripSkeleton />
    </View>
  );
}

type XAxisOverrides = {
  domain: number[];
  tickFormatter: (x: number) => string;
};

type QueueSizeVariables = {
  fetchKey: string;
  timeRange: { start: string; end: string };
  timeBinConfig: ServerEvaluationQueueSizeChartQuery["variables"]["timeBinConfig"];
};

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

type ByProjectMetric = "lag" | "queueSize";

function ByProjectPanel({
  activity,
  projectSeries,
  xAxisProps,
  queueSizeVariables,
}: {
  activity: Activity;
  projectSeries: ServerProjectSeries;
  xAxisProps: XAxisOverrides;
  queueSizeVariables: QueueSizeVariables;
}) {
  const [metric, setMetric] = useState<ByProjectMetric>("lag");
  return (
    <ChartPanel
      title="By project"
      fillHeight
      actions={
        <ToggleButtonGroup
          size="S"
          aria-label="Chart by project"
          selectedKeys={[metric]}
          onSelectionChange={(keys) => {
            const [key] = [...keys];
            if (key === "lag" || key === "queueSize") {
              setMetric(key);
            }
          }}
        >
          <ToggleButton id="lag">Lag p95</ToggleButton>
          <ToggleButton id="queueSize">Queue size</ToggleButton>
        </ToggleButtonGroup>
      }
    >
      {metric === "lag" ? (
        <LagByProjectChart
          activity={activity}
          projectSeries={projectSeries}
          xAxisProps={xAxisProps}
        />
      ) : (
        <QueueSizeByProjectChart
          projectSeries={projectSeries}
          xAxisProps={xAxisProps}
          variables={queueSizeVariables}
        />
      )}
    </ChartPanel>
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
  const { series, getKey, isFiltered, isShown } = projectSeries;
  return activity.series.map((bin) => {
    const datum: Record<string, number | null> = {
      timestamp: new Date(bin.timestamp).getTime(),
    };
    for (const { key } of series) {
      datum[key] = null;
    }
    for (const group of bin.groups) {
      if (
        group.lagP95Seconds == null ||
        (isFiltered && !isShown(group.project.id))
      ) {
        continue;
      }
      const key = getKey(group.project.id);
      datum[key] = Math.max(datum[key] ?? 0, group.lagP95Seconds);
    }
    return datum;
  });
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
  const semanticColors = useSemanticChartColors();
  const { series } = projectSeries;
  const chartData = getLagRows({ activity, projectSeries });
  const lags = chartData.flatMap((datum) =>
    series.flatMap(({ key }) => (datum[key] != null ? [datum[key]] : []))
  );
  const ticks = getDurationTicks(Math.max(LAG_WARNING_SECONDS, ...lags));
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
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
          {series.map(({ key, name, color }) => (
            <Line
              key={key}
              type="stepAfter"
              dataKey={key}
              name={name}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              hide={isDataKeyHidden(key)}
              isAnimationActive={false}
            />
          ))}
          <ReferenceLine
            y={LAG_WARNING_SECONDS}
            stroke={semanticColors.warning}
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
            label={{
              value: formatLag(LAG_WARNING_SECONDS),
              position: "insideTopRight",
              fill: semanticColors.warning,
              fontSize: 12,
            }}
          />
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconType="circle"
            iconSize={8}
            itemSorter={null}
            onToggleDataKey={toggleDataKey}
          />
        </LineChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}

/**
 * Each project's evaluations in queue at each bin's end. Read only while
 * shown: it counts every evaluation in queue.
 */
function QueueSizeByProjectChart({
  projectSeries,
  xAxisProps,
  variables: { fetchKey, timeRange, timeBinConfig },
}: {
  projectSeries: ServerProjectSeries;
  xAxisProps: XAxisOverrides;
  variables: QueueSizeVariables;
}) {
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
            groups {
              project {
                id
              }
              queueSize
            }
          }
        }
      }
    `,
    { timeRange, timeBinConfig },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  const bins = data.evaluationActivity.series;
  const { series, getKey } = projectSeries;
  const chartData = bins.map((bin) => {
    const datum: Record<string, number> = {
      timestamp: new Date(bin.timestamp).getTime(),
    };
    for (const { key } of series) {
      datum[key] = 0;
    }
    for (const group of bin.groups) {
      const key = getKey(group.project.id);
      datum[key] = (datum[key] ?? 0) + group.queueSize;
    }
    return datum;
  });
  const hasData = bins.some((bin) =>
    bin.groups.some((group) => group.queueSize > 0)
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
        <AreaChart data={chartData} margin={compactChartMargin}>
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis {...xAxisProps} />
          <YAxis
            {...compactYAxisProps}
            tickFormatter={(y) => intShortFormatter(y)}
          />
          <Tooltip content={TimeTooltipContent} {...defaultTooltipProps} />
          {series.map(({ key, name, color }) => (
            <Area
              key={key}
              type="stepAfter"
              dataKey={key}
              name={name}
              stackId="queue"
              stroke={color}
              fill={color}
              fillOpacity={0.4}
              hide={isDataKeyHidden(key)}
              isAnimationActive={false}
            />
          ))}
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconType="circle"
            iconSize={8}
            itemSorter={null}
            onToggleDataKey={toggleDataKey}
          />
        </AreaChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}

function AddedVsCompletedChart({
  activity,
  projectSeries,
  xAxisProps,
}: {
  activity: Activity;
  projectSeries: ServerProjectSeries;
  xAxisProps: XAxisOverrides;
}) {
  const semanticColors = useSemanticChartColors();
  const { isFiltered, isShown } = projectSeries;
  const chartData = activity.series.map((bin) => {
    const groups = isFiltered
      ? bin.groups.filter((group) => isShown(group.project.id))
      : bin.groups;
    return {
      timestamp: new Date(bin.timestamp).getTime(),
      added: groups.reduce((sum, group) => sum + group.addedCount, 0),
      completed: groups.reduce(
        (sum, group) => sum + group.evaluatedCount + group.failedCount,
        0
      ),
    };
  });
  const hasData = chartData.some(
    (datum) => datum.added > 0 || datum.completed > 0
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
        <BarChart data={chartData} margin={compactChartMargin} maxBarSize={8}>
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis {...xAxisProps} />
          <YAxis
            {...compactYAxisProps}
            tickFormatter={(y) => intShortFormatter(y)}
          />
          <Tooltip content={TimeTooltipContent} {...defaultTooltipProps} />
          <Bar
            dataKey="added"
            name="Added"
            fill={ADDED_COLOR}
            hide={isDataKeyHidden("added")}
            isAnimationActive={false}
          />
          <Bar
            dataKey="completed"
            name="Completed"
            fill={semanticColors.success}
            hide={isDataKeyHidden("completed")}
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
        </BarChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}

type TopProjectsMetric = "evaluations" | "cost";

const rankedListCSS = css`
  display: grid;
  grid-template-columns: fit-content(40%) minmax(0, 1fr) auto auto;
  column-gap: var(--global-dimension-size-150);
  row-gap: var(--global-dimension-size-75);
  align-items: center;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  .ranked-list__track {
    height: 8px;
    border-radius: 2px;
    background-color: var(--global-color-gray-200);
    overflow: hidden;
  }
  .ranked-list__bar {
    height: 100%;
    border-radius: 2px;
  }
`;

/** Each shown project's total for the metric, largest first, then the rest. */
function getTopProjectRows({
  activity,
  projectSeries,
  metric,
}: {
  activity: Activity;
  projectSeries: ServerProjectSeries;
  metric: TopProjectsMetric;
}): Array<ProjectSeries & { value: number }> {
  const { series, getKey, isFiltered } = projectSeries;
  const totals = new Map<string, number>();
  for (const group of activity.groups) {
    const key = getKey(group.project.id);
    const value =
      metric === "evaluations"
        ? group.evaluatedCount + group.failedCount
        : (group.cost ?? 0);
    totals.set(key, (totals.get(key) ?? 0) + value);
  }
  const ranked = series
    .map((entry) => ({ ...entry, value: totals.get(entry.key) ?? 0 }))
    // A picked project shows even with nothing to rank.
    .filter(
      (entry) =>
        entry.key !== OTHER_PROJECTS_KEY && (isFiltered || entry.value > 0)
    )
    .sort((a, b) => b.value - a.value);
  const other = series.find((entry) => entry.key === OTHER_PROJECTS_KEY);
  const otherValue = other != null ? (totals.get(other.key) ?? 0) : 0;
  return other != null && otherValue > 0
    ? [...ranked, { ...other, value: otherValue }]
    : ranked;
}

function TopProjectsPanel({
  activity,
  projectSeries,
}: {
  activity: Activity;
  projectSeries: ServerProjectSeries;
}) {
  const [metric, setMetric] = useState<TopProjectsMetric>("evaluations");
  const rows = getTopProjectRows({ activity, projectSeries, metric });
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const max = Math.max(...rows.map((row) => row.value), 0);
  const format = metric === "evaluations" ? intFormatter : costFormatter;
  return (
    <ChartPanel
      title="Top projects"
      subtitle={
        metric === "cost" && activity.excludesUntracedEvaluators
          ? "Excludes evaluators with tracing off"
          : undefined
      }
      fillHeight
      actions={
        <ToggleButtonGroup
          size="S"
          aria-label="Rank projects by"
          selectedKeys={[metric]}
          onSelectionChange={(keys) => {
            const [key] = [...keys];
            if (key === "evaluations" || key === "cost") {
              setMetric(key);
            }
          }}
        >
          <ToggleButton id="evaluations">Evaluations</ToggleButton>
          <ToggleButton id="cost">Cost</ToggleButton>
        </ToggleButtonGroup>
      }
    >
      {rows.length === 0 || total === 0 ? (
        <Flex height="100%" alignItems="center" justifyContent="center">
          <Text color="text-700" size="S">
            No evaluations in this time range
          </Text>
        </Flex>
      ) : (
        <div css={rankedListCSS}>
          {rows.map((row) => (
            <RankedRow
              key={row.key}
              name={row.name}
              color={row.color}
              value={format(row.value)}
              share={row.value / total}
              width={max > 0 ? row.value / max : 0}
            />
          ))}
        </div>
      )}
    </ChartPanel>
  );
}

const shareFormatter = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 0,
});

function RankedRow({
  name,
  color,
  value,
  share,
  width,
}: {
  name: string;
  color: string;
  value: string;
  share: number;
  width: number;
}) {
  return (
    <>
      <Text size="S" minWidth={0}>
        <Truncate maxWidth="100%" title={name}>
          {name}
        </Truncate>
      </Text>
      <div className="ranked-list__track">
        <div
          className="ranked-list__bar"
          style={{ width: `${width * 100}%`, backgroundColor: color }}
        />
      </div>
      <Text size="S" fontFamily="mono">
        {value}
      </Text>
      <Text size="S" fontFamily="mono" color="text-700">
        {shareFormatter.format(share)}
      </Text>
    </>
  );
}
