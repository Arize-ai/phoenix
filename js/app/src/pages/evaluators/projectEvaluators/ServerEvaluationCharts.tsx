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
import { useClosedTimeRange } from "@phoenix/pages/project/metrics/useClosedTimeRange";
import {
  costFormatter,
  floatShortFormatter,
  intFormatter,
} from "@phoenix/utils/numberFormatUtils";

type Activity = ServerEvaluationChartsQuery$data["evaluationActivity"];

/** Projects past this many by evaluations share one "other projects" series. */
const TOP_PROJECT_COUNT = 5;
const OTHER_PROJECTS_KEY = "other";
const OTHER_PROJECTS_COLOR = "var(--global-color-gray-600)";

type ProjectSeries = { key: string; name: string; color: string };

/**
 * The projects with the most evaluations in the range, each with a stable
 * color across the strip's charts, then one series for the rest.
 */
function useProjectSeries(activity: Activity): {
  series: ProjectSeries[];
  getKey: (projectId: string) => string;
  otherCount: number;
} {
  const colors = useCategoryChartColors();
  return useMemo(() => {
    const ranked = [...activity.groups].sort(
      (a, b) =>
        b.evaluatedCount + b.failedCount - (a.evaluatedCount + a.failedCount)
    );
    const top = ranked.slice(0, TOP_PROJECT_COUNT);
    const topIds = new Set(top.map((group) => group.project.id));
    const palette = [
      colors.category1,
      colors.category2,
      colors.category3,
      colors.category4,
      colors.category5,
    ];
    const otherCount = ranked.length - top.length;
    const series: ProjectSeries[] = top.map((group, index) => ({
      key: group.project.id,
      name: group.project.name,
      color: palette[index] ?? OTHER_PROJECTS_COLOR,
    }));
    if (otherCount > 0) {
      series.push({
        key: OTHER_PROJECTS_KEY,
        name:
          otherCount === 1 ? "1 other project" : `${otherCount} other projects`,
        color: OTHER_PROJECTS_COLOR,
      });
    }
    return {
      series,
      getKey: (projectId: string) =>
        topIds.has(projectId) ? projectId : OTHER_PROJECTS_KEY,
      otherCount,
    };
  }, [activity.groups, colors]);
}

/**
 * Charts of the shared queue over the selected range: how full it was by
 * project, what entered and left it, and which projects used it most.
 */
export function ServerEvaluationCharts({ fetchKey }: { fetchKey: number }) {
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
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  const activity = data.evaluationActivity;
  const projectSeries = useProjectSeries(activity);
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
        <ChartPanel
          title="Queue size"
          subtitle="Evaluations queued or running, by project"
          fillHeight
        >
          <QueueSizeChart
            activity={activity}
            projectSeries={projectSeries}
            queuedLimit={data.evaluationQueue.queuedLimit}
            xAxisProps={xAxisProps}
          />
        </ChartPanel>
        <ChartPanel
          title="Queued vs completed"
          subtitle="Evaluations entering and leaving the queue"
          fillHeight
        >
          <QueuedVsCompletedChart activity={activity} xAxisProps={xAxisProps} />
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
  projectSeries: ReturnType<typeof useProjectSeries>;
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
            tickFormatter={(y) => floatShortFormatter(y)}
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
              value: `Limit ${floatShortFormatter(queuedLimit)}`,
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
            onToggleDataKey={toggleDataKey}
          />
        </AreaChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}

function QueuedVsCompletedChart({
  activity,
  xAxisProps,
}: {
  activity: Activity;
  xAxisProps: XAxisOverrides;
}) {
  const colors = useCategoryChartColors();
  const chartData = useMemo(
    () =>
      activity.series.map((bin) => ({
        timestamp: new Date(bin.timestamp).getTime(),
        queued: bin.groups.reduce((sum, group) => sum + group.queuedCount, 0),
        completed: bin.groups.reduce(
          (sum, group) => sum + group.evaluatedCount + group.failedCount,
          0
        ),
      })),
    [activity.series]
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
            tickFormatter={(y) => floatShortFormatter(y)}
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
  projectSeries: ReturnType<typeof useProjectSeries>;
}) {
  const [metric, setMetric] = useState<TopProjectsMetric>("evaluations");
  const { series, getKey } = projectSeries;
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
      .filter((entry) => entry.key !== OTHER_PROJECTS_KEY)
      .sort((a, b) => b.value - a.value);
    const other = series.find((entry) => entry.key === OTHER_PROJECTS_KEY);
    return other != null
      ? [...ranked, { ...other, value: totals.get(other.key) ?? 0 }]
      : ranked;
  }, [activity.groups, getKey, metric, series]);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const max = Math.max(...rows.map((row) => row.value), 0);
  const format = metric === "evaluations" ? intFormatter : costFormatter;
  return (
    <ChartPanel
      title="Top projects"
      subtitle={
        metric === "evaluations"
          ? "Evaluations completed, by project"
          : "Estimated LLM cost of evaluations, by project"
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
