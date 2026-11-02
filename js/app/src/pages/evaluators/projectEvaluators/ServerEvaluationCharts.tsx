import { css } from "@emotion/react";
import { useEffect, useState } from "react";
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
} from "@phoenix/components";
import {
  CHART_MIN_WIDTH,
  ChartEmptyStateOverlay,
  ChartPanel,
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
import type {
  ProjectSeries,
  ServerProjectSeries,
} from "@phoenix/pages/evaluators/projectEvaluators/serverProjectSeries";
import {
  getServerProjectSeries,
  OTHER_PROJECTS_KEY,
} from "@phoenix/pages/evaluators/projectEvaluators/serverProjectSeries";
import { useClosedTimeRange } from "@phoenix/pages/project/metrics/useClosedTimeRange";
import {
  costFormatter,
  intFormatter,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

type Activity = ServerEvaluationChartsQuery$data["evaluationActivity"];

const OTHER_PROJECTS_COLOR = "var(--global-color-gray-600)";

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
 * Which projects get their own series and color in the charts and the project
 * picker; see {@link getServerProjectSeries}.
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

type PickedProjectsProps = {
  /** Projects picked to show on their own; none shows the heaviest few. */
  pickedProjectIds: ReadonlyArray<string>;
  /** Called to drop picks that no longer name a project with an evaluator. */
  onPickedProjectIdsChange: (projectIds: string[]) => void;
};

function useDropStalePickedProjectIds({
  projectSeries,
  pickedProjectIds,
  onPickedProjectIdsChange,
}: PickedProjectsProps & { projectSeries: ServerProjectSeries }) {
  const hasStalePicks =
    projectSeries.pickedIds.length !== pickedProjectIds.length;
  useEffect(() => {
    if (hasStalePicks) {
      onPickedProjectIdsChange(projectSeries.pickedIds);
    }
  }, [hasStalePicks, onPickedProjectIdsChange, projectSeries.pickedIds]);
}

/**
 * Drops picked projects that no longer have an evaluator, for pages that
 * filter by the picks without showing the charts.
 */
export function ServerStalePickedProjectsPruner({
  fetchKey,
  pickedProjectIds,
  onPickedProjectIdsChange,
}: PickedProjectsProps & { fetchKey: number }) {
  const { data } = useServerEvaluationActivity({
    fetchKey,
    fetchPolicy: "store-or-network",
  });
  const projectSeries = useServerProjectSeries(data, pickedProjectIds);
  useDropStalePickedProjectIds({
    projectSeries,
    pickedProjectIds,
    onPickedProjectIdsChange,
  });
  return null;
}

const CHART_ROW_HEIGHT_PIXELS = 300;

const chartsGridCSS = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${CHART_MIN_WIDTH}px, 1fr));
  grid-auto-rows: ${CHART_ROW_HEIGHT_PIXELS}px;
  gap: var(--global-dimension-size-200);
  .server-evaluation-charts__wide {
    grid-column: 1 / -1;
    display: grid;
  }
`;

/**
 * Charts of the shared queue over the selected range: how full it was by
 * project, what entered and left it, and which projects used it most.
 */
export function ServerEvaluationCharts({
  fetchKey,
  pickedProjectIds,
  onPickedProjectIdsChange,
}: PickedProjectsProps & { fetchKey: number }) {
  const { data, timeRange, scale } = useServerEvaluationActivity({ fetchKey });
  const activity = data.evaluationActivity;
  const projectSeries = useServerProjectSeries(data, pickedProjectIds);
  useDropStalePickedProjectIds({
    projectSeries,
    pickedProjectIds,
    onPickedProjectIdsChange,
  });
  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const xAxisProps = {
    ...compactTimeXAxisProps,
    domain: [timeRange.start.getTime(), timeRange.end.getTime()],
    tickFormatter: (x: number) => timeTickFormatter(new Date(x)),
  };
  return (
    <div css={chartsGridCSS} className="server-evaluation-charts">
      <div className="server-evaluation-charts__wide">
        <ChartPanel title="Queue size by project" fillHeight>
          <QueueSizeChart
            activity={activity}
            projectSeries={projectSeries}
            queuedLimit={data.evaluationQueue.queuedLimit}
            xAxisProps={xAxisProps}
          />
        </ChartPanel>
      </div>
      <ChartPanel title="Queued vs completed" fillHeight>
        <QueuedVsCompletedChart
          activity={activity}
          projectSeries={projectSeries}
          xAxisProps={xAxisProps}
        />
      </ChartPanel>
      <TopProjectsPanel activity={activity} projectSeries={projectSeries} />
    </div>
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
  projectSeries: ServerProjectSeries;
  queuedLimit: number;
  xAxisProps: XAxisOverrides;
}) {
  const { series, getKey } = projectSeries;
  const chartData = activity.series.map((bin) => {
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
  projectSeries: ServerProjectSeries;
  xAxisProps: XAxisOverrides;
}) {
  const colors = useCategoryChartColors();
  const { isFiltered, isShown } = projectSeries;
  const chartData = activity.series.map((bin) => {
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
  });
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
