import { css } from "@emotion/react";
import { useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import type { TooltipContentProps } from "recharts";
import {
  Area,
  AreaChart,
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
} from "@phoenix/components/chart";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import type {
  ServerEvaluationChartsQuery,
  ServerEvaluationChartsQuery$data,
} from "@phoenix/pages/evaluators/projectEvaluators/__generated__/ServerEvaluationChartsQuery.graphql";
import {
  getShownProjectIds,
  OTHER_PROJECTS_KEY,
  rankProjects,
} from "@phoenix/pages/evaluators/projectEvaluators/serverProjectSeries";
import { useClosedTimeRange } from "@phoenix/pages/project/metrics/useClosedTimeRange";
import {
  costFormatter,
  intFormatter,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

type Activity = ServerEvaluationChartsQuery$data["evaluationActivity"];

const OTHER_PROJECTS_COLOR = "var(--global-color-gray-600)";

type ProjectSeries = { key: string; name: string; color: string };

/**
 * The server's evaluation activity over the selected range, grouped by
 * project, with each project's evaluations in the queue now. The charts and
 * the project picker read the same request.
 */
export function useServerEvaluationActivity({
  fetchKey,
  fetchPolicy = "store-and-network",
}: {
  fetchKey: number;
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
          queuedLimit
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
              queuedCount
              queueSize
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
  return { data, timeRange, scale };
}

/**
 * Which projects get their own series and color: the picked ones, or the
 * heaviest few. The rest share one "other projects" series, so totals still
 * add up against the shared queue limit.
 */
export function useServerProjectSeries(
  data: ServerEvaluationChartsQuery$data,
  pickedProjectIds: ReadonlyArray<string>
) {
  const colors = useCategoryChartColors();
  return useMemo(() => {
    const ranked = rankProjects({
      groups: data.evaluationActivity.groups,
      queued: data.evaluationQueue.projects,
    });
    const shownIds = getShownProjectIds(ranked, pickedProjectIds);
    const shown = new Set(shownIds);
    const palette = [
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
    ];
    const colorById = new Map(
      shownIds.map((id, index) => [id, palette[index] ?? OTHER_PROJECTS_COLOR])
    );
    const nameById = new Map(
      ranked.map((project) => [project.id, project.name])
    );
    const isFiltered = pickedProjectIds.length > 0;
    const otherCount = ranked.length - shownIds.length;
    const series: ProjectSeries[] = shownIds.map((id) => ({
      key: id,
      name: nameById.get(id) ?? id,
      color: colorById.get(id) ?? OTHER_PROJECTS_COLOR,
    }));
    // Picks are a filter: only the picked projects show.
    if (!isFiltered && otherCount > 0) {
      series.push({
        key: OTHER_PROJECTS_KEY,
        name:
          otherCount === 1 ? "1 other project" : `${otherCount} other projects`,
        color: OTHER_PROJECTS_COLOR,
      });
    }
    return {
      ranked,
      series,
      colorById,
      isFiltered,
      isShown: (projectId: string) => shown.has(projectId),
      getKey: (projectId: string) =>
        shown.has(projectId) ? projectId : OTHER_PROJECTS_KEY,
    };
  }, [data, pickedProjectIds, colors]);
}

/**
 * Charts of the shared queue over the selected range: how full it was by
 * project, what entered and left it, and which projects used it most.
 */
export function ServerEvaluationCharts({
  fetchKey,
  pickedProjectIds,
}: {
  fetchKey: number;
  /** Projects picked to show on their own; none shows the heaviest few. */
  pickedProjectIds: ReadonlyArray<string>;
}) {
  const { data, timeRange, scale } = useServerEvaluationActivity({ fetchKey });
  const activity = data.evaluationActivity;
  const projectSeries = useServerProjectSeries(data, pickedProjectIds);
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
        <ChartPanel title="Queue size by project" fillHeight>
          <QueueSizeChart
            activity={activity}
            projectSeries={projectSeries}
            queuedLimit={data.evaluationQueue.queuedLimit}
            xAxisProps={xAxisProps}
          />
        </ChartPanel>
        <ChartPanel title="Queued vs completed" fillHeight>
          <QueuedVsCompletedChart
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

type XAxisOverrides = {
  domain: number[];
  tickFormatter: (x: number) => string;
};

function TimeTooltipContent({ active, payload, label }: TooltipContentProps) {
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
      {payload.map((entry) => (
        <ChartTooltipItem
          key={String(entry.dataKey)}
          color={entry.color ?? "transparent"}
          shape="circle"
          name={String(entry.name ?? entry.dataKey)}
          value={intFormatter(Number(entry.value))}
        />
      ))}
    </ChartTooltip>
  );
}

function QueueSizeChart({
  activity,
  projectSeries,
  queuedLimit,
  xAxisProps,
}: {
  activity: Activity;
  projectSeries: ReturnType<typeof useServerProjectSeries>;
  queuedLimit: number;
  xAxisProps: XAxisOverrides;
}) {
  const { series, getKey } = projectSeries;
  const chartData = useMemo(
    () =>
      activity.series.map((bin) => {
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
      }),
    [activity.series, series, getKey]
  );
  const hasData = activity.series.some((bin) =>
    bin.groups.some((group) => group.queueSize > 0)
  );
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasData}
      message="Nothing queued in this time range"
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
          <ReferenceLine
            y={queuedLimit}
            stroke="var(--global-color-gray-500)"
            strokeDasharray="4 4"
            // Shown once the queue's own scale reaches the limit; extending the
            // axis to it would flatten a normal queue against the baseline.
            ifOverflow="discard"
            label={{
              value: `Limit ${intShortFormatter(queuedLimit)}`,
              position: "insideTopLeft",
              fontSize: 11,
              fill: "var(--global-text-color-700)",
            }}
          />
          {series.map(({ key, name, color }) => (
            <Area
              key={key}
              type="monotone"
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

function QueuedVsCompletedChart({
  activity,
  projectSeries,
  xAxisProps,
}: {
  activity: Activity;
  projectSeries: ReturnType<typeof useServerProjectSeries>;
  xAxisProps: XAxisOverrides;
}) {
  const colors = useCategoryChartColors();
  const { isFiltered, isShown } = projectSeries;
  const chartData = useMemo(
    () =>
      activity.series.map((bin) => {
        const groups = isFiltered
          ? bin.groups.filter((group) => isShown(group.project.id))
          : bin.groups;
        return {
          timestamp: new Date(bin.timestamp).getTime(),
          queued: groups.reduce((sum, group) => sum + group.queuedCount, 0),
          completed: groups.reduce(
            (sum, group) => sum + group.evaluatedCount + group.failedCount,
            0
          ),
        };
      }),
    [activity.series, isFiltered, isShown]
  );
  const hasData = chartData.some(
    (datum) => datum.queued > 0 || datum.completed > 0
  );
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasData}
      message="No evaluations in this time range"
      chartType="line"
    >
      <ChartResponsiveContainer>
        <LineChart data={chartData} margin={compactChartMargin}>
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis {...xAxisProps} />
          <YAxis
            {...compactYAxisProps}
            tickFormatter={(y) => intShortFormatter(y)}
          />
          <Tooltip content={TimeTooltipContent} {...defaultTooltipProps} />
          <Line
            type="monotone"
            dataKey="queued"
            name="Queued"
            stroke={colors.category5}
            dot={false}
            hide={isDataKeyHidden("queued")}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="completed"
            name="Completed"
            stroke={colors.category1}
            dot={false}
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
        </LineChart>
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

function TopProjectsPanel({
  activity,
  projectSeries,
}: {
  activity: Activity;
  projectSeries: ReturnType<typeof useServerProjectSeries>;
}) {
  const [metric, setMetric] = useState<TopProjectsMetric>("evaluations");
  const { series, getKey, isFiltered } = projectSeries;
  const rows = useMemo(() => {
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
  }, [activity.groups, getKey, metric, series, isFiltered]);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const max = Math.max(...rows.map((row) => row.value), 0);
  const format = metric === "evaluations" ? intFormatter : costFormatter;
  return (
    <ChartPanel
      title="Top projects"
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
