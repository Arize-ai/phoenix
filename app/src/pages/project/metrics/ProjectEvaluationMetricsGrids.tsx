import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Loading, Text } from "@phoenix/components";
import {
  AnnotationMetricsChart,
  type AnnotationMetricsSeries,
  AnnotationScoreLabelToggle,
  ChartPanel,
  TimeRangeChartBrush,
  compactTimeXAxisProps,
  compactYAxisProps,
  getDefaultAnnotationMetricsView,
  getEmptyAnnotationMetricsSeries,
  normalizeAnnotationMetrics,
  useBinTimeTickFormatter,
} from "@phoenix/components/chart";
import { ErrorBoundary } from "@phoenix/components/exception";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";

import type { ProjectEvaluationMetricNamesSessionQuery } from "./__generated__/ProjectEvaluationMetricNamesSessionQuery.graphql";
import type { ProjectEvaluationMetricNamesSpanQuery } from "./__generated__/ProjectEvaluationMetricNamesSpanQuery.graphql";
import type { ProjectEvaluationMetricNamesTraceQuery } from "./__generated__/ProjectEvaluationMetricNamesTraceQuery.graphql";
import type { ProjectEvaluationMetricsGridsSessionQuery } from "./__generated__/ProjectEvaluationMetricsGridsSessionQuery.graphql";
import type { ProjectEvaluationMetricsGridsSpanQuery } from "./__generated__/ProjectEvaluationMetricsGridsSpanQuery.graphql";
import type { ProjectEvaluationMetricsGridsTraceQuery } from "./__generated__/ProjectEvaluationMetricsGridsTraceQuery.graphql";
import type { ProjectMetricViewProps } from "./types";
import {
  PROJECT_METRICS_CHART_SYNC_ID,
  useMetricQueryFetchOptions,
} from "./types";

type AnnotationMetricsData = ReadonlyArray<{
  readonly timestamp: string;
  readonly annotationSummaries: ReadonlyArray<{
    readonly name: string;
    readonly meanScore: number | null;
    readonly labelFractions: ReadonlyArray<{
      readonly label: string;
      readonly fraction: number;
    }>;
  }>;
}>;

function getProjectEvaluationMetricsSeries(
  data: AnnotationMetricsData
): AnnotationMetricsSeries[] {
  return normalizeAnnotationMetrics({
    points: data.map((point) => ({
      x: new Date(point.timestamp).getTime(),
      summaries: point.annotationSummaries,
    })),
    // Retain empty bins so score lines break instead of connecting across
    // periods in which the evaluation produced no result.
    includeEmptyPoints: true,
  });
}

const evaluationGridCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-200);

  @container (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

function ProjectEvaluationMetricsGrid({
  evaluationSeries,
  timeRange,
  onTimeRangeSelected,
}: {
  evaluationSeries: AnnotationMetricsSeries[];
  timeRange: TimeRange;
  onTimeRangeSelected?: (timeRange: TimeRange) => void;
}) {
  const scale = useTimeBinScale({ timeRange });
  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const { fullTimeFormatter } = useTimeFormatters();
  if (evaluationSeries.length === 0) {
    return null;
  }

  return (
    <div css={evaluationGridCSS} data-testid="project-evaluation-grid">
      {evaluationSeries.map((series) => (
        <ProjectEvaluationMetricsPanel
          key={series.name}
          series={series}
          timeRange={timeRange}
          timeTickFormatter={timeTickFormatter}
          fullTimeFormatter={fullTimeFormatter}
          onTimeRangeSelected={onTimeRangeSelected}
        />
      ))}
    </div>
  );
}

export function ProjectEvaluationMetricsPanel({
  series,
  timeRange,
  timeTickFormatter,
  fullTimeFormatter,
  onTimeRangeSelected,
  fillHeight = false,
}: {
  series: AnnotationMetricsSeries;
  timeRange: TimeRange;
  timeTickFormatter: (date: Date) => string;
  fullTimeFormatter: (date: Date) => string;
  onTimeRangeSelected?: (timeRange: TimeRange) => void;
  fillHeight?: boolean;
}) {
  const [view, setView] = useState(() =>
    getDefaultAnnotationMetricsView(series)
  );
  const activeView = series.views.includes(view)
    ? view
    : getDefaultAnnotationMetricsView(series);
  const showViewToggle = series.views.length > 1;

  return (
    <ChartPanel
      title={series.name}
      subtitle="Evaluation results over time"
      fillHeight={fillHeight}
      actions={
        showViewToggle ? (
          <AnnotationScoreLabelToggle view={activeView} onChange={setView} />
        ) : undefined
      }
    >
      <TimeRangeChartBrush onTimeRangeSelected={onTimeRangeSelected}>
        {({ chartProps }) => (
          <AnnotationMetricsChart
            series={series}
            view={activeView}
            xAxisProps={{
              ...compactTimeXAxisProps,
              dataKey: "x",
              domain: [timeRange.start.getTime(), timeRange.end.getTime()],
              tickFormatter: (value) =>
                timeTickFormatter(new Date(Number(value))),
            }}
            yAxisProps={compactYAxisProps}
            syncId={PROJECT_METRICS_CHART_SYNC_ID}
            chartProps={chartProps}
            renderTooltipHeader={(point) => (
              <Text weight="heavy" size="S">
                {fullTimeFormatter(new Date(point.x))}
              </Text>
            )}
          />
        )}
      </TimeRangeChartBrush>
    </ChartPanel>
  );
}

function ProjectEvaluationMetricPanelBoundary({
  evaluationName,
  fillHeight,
  children,
}: {
  evaluationName: string;
  fillHeight: boolean;
  children: ReactNode;
}) {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <ChartPanel
            title={evaluationName}
            subtitle="Evaluation results over time"
            fillHeight={fillHeight}
          >
            <Loading />
          </ChartPanel>
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function ProjectEvaluationMetricPanelContent({
  evaluationSeries,
  evaluationName,
  fillHeight,
  ...props
}: ProjectMetricViewProps & {
  evaluationSeries: AnnotationMetricsSeries[];
  evaluationName: string;
  fillHeight: boolean;
}) {
  const scale = useTimeBinScale({ timeRange: props.timeRange });
  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const { fullTimeFormatter } = useTimeFormatters();
  const series =
    evaluationSeries.find(({ name }) => name === evaluationName) ??
    getEmptyAnnotationMetricsSeries(evaluationName);
  return (
    <ProjectEvaluationMetricsPanel
      {...props}
      series={series}
      timeTickFormatter={timeTickFormatter}
      fullTimeFormatter={fullTimeFormatter}
      fillHeight={fillHeight}
    />
  );
}

type ProjectEvaluationMetricPanelProps = ProjectMetricViewProps & {
  evaluationName: string;
  fillHeight?: boolean;
};

export function SpanEvaluationMetricPanel({
  fillHeight = false,
  ...props
}: ProjectEvaluationMetricPanelProps) {
  return (
    <ProjectEvaluationMetricPanelBoundary
      evaluationName={props.evaluationName}
      fillHeight={fillHeight}
    >
      <SpanEvaluationMetricPanelContent {...props} fillHeight={fillHeight} />
    </ProjectEvaluationMetricPanelBoundary>
  );
}

function SpanEvaluationMetricPanelContent({
  fillHeight,
  ...props
}: ProjectEvaluationMetricPanelProps & { fillHeight: boolean }) {
  const evaluationSeries = useSpanEvaluationMetricsSeries(props);
  return (
    <ProjectEvaluationMetricPanelContent
      {...props}
      evaluationSeries={evaluationSeries}
      fillHeight={fillHeight}
    />
  );
}

export function TraceEvaluationMetricPanel({
  fillHeight = false,
  ...props
}: ProjectEvaluationMetricPanelProps) {
  return (
    <ProjectEvaluationMetricPanelBoundary
      evaluationName={props.evaluationName}
      fillHeight={fillHeight}
    >
      <TraceEvaluationMetricPanelContent {...props} fillHeight={fillHeight} />
    </ProjectEvaluationMetricPanelBoundary>
  );
}

function TraceEvaluationMetricPanelContent({
  fillHeight,
  ...props
}: ProjectEvaluationMetricPanelProps & { fillHeight: boolean }) {
  const evaluationSeries = useTraceEvaluationMetricsSeries(props);
  return (
    <ProjectEvaluationMetricPanelContent
      {...props}
      evaluationSeries={evaluationSeries}
      fillHeight={fillHeight}
    />
  );
}

export function SessionEvaluationMetricPanel({
  fillHeight = false,
  ...props
}: ProjectEvaluationMetricPanelProps) {
  return (
    <ProjectEvaluationMetricPanelBoundary
      evaluationName={props.evaluationName}
      fillHeight={fillHeight}
    >
      <SessionEvaluationMetricPanelContent {...props} fillHeight={fillHeight} />
    </ProjectEvaluationMetricPanelBoundary>
  );
}

function SessionEvaluationMetricPanelContent({
  fillHeight,
  ...props
}: ProjectEvaluationMetricPanelProps & { fillHeight: boolean }) {
  const evaluationSeries = useSessionEvaluationMetricsSeries(props);
  return (
    <ProjectEvaluationMetricPanelContent
      {...props}
      evaluationSeries={evaluationSeries}
      fillHeight={fillHeight}
    />
  );
}

// Keep each Relay query below its own Suspense boundary. Suspending from the
// page can remount the metrics tree and repeatedly restart the query.
function getSortedEvaluationNames(
  names: ReadonlyArray<string>
): ReadonlyArray<string> {
  return [...names].sort((left, right) => left.localeCompare(right));
}

export function useSpanEvaluationMetricNames(
  props: ProjectMetricViewProps
): ReadonlyArray<string> {
  const data = useLazyLoadQuery<ProjectEvaluationMetricNamesSpanQuery>(
    graphql`
      query ProjectEvaluationMetricNamesSpanQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            spanAnnotationNames
          }
        }
      }
    `,
    { projectId: props.projectId },
    useMetricQueryFetchOptions()
  );
  return getSortedEvaluationNames(data.project.spanAnnotationNames ?? []);
}

export function useTraceEvaluationMetricNames(
  props: ProjectMetricViewProps
): ReadonlyArray<string> {
  const data = useLazyLoadQuery<ProjectEvaluationMetricNamesTraceQuery>(
    graphql`
      query ProjectEvaluationMetricNamesTraceQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            traceAnnotationsNames
          }
        }
      }
    `,
    { projectId: props.projectId },
    useMetricQueryFetchOptions()
  );
  return getSortedEvaluationNames(data.project.traceAnnotationsNames ?? []);
}

export function useSessionEvaluationMetricNames(
  props: ProjectMetricViewProps
): ReadonlyArray<string> {
  const data = useLazyLoadQuery<ProjectEvaluationMetricNamesSessionQuery>(
    graphql`
      query ProjectEvaluationMetricNamesSessionQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            sessionAnnotationNames
          }
        }
      }
    `,
    { projectId: props.projectId },
    useMetricQueryFetchOptions()
  );
  return getSortedEvaluationNames(data.project.sessionAnnotationNames ?? []);
}

export function SpanEvaluationMetricsGrid(props: ProjectMetricViewProps) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <SpanEvaluationMetricsGridContent {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

function SpanEvaluationMetricsGridContent(props: ProjectMetricViewProps) {
  const evaluationSeries = useSpanEvaluationMetricsSeries(props);
  return (
    <ProjectEvaluationMetricsGrid
      {...props}
      evaluationSeries={evaluationSeries}
    />
  );
}

export function useSpanEvaluationMetricsSeries(props: ProjectMetricViewProps) {
  const scale = useTimeBinScale({ timeRange: props.timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const data = useLazyLoadQuery<ProjectEvaluationMetricsGridsSpanQuery>(
    graphql`
      query ProjectEvaluationMetricsGridsSpanQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            spanAnnotationMetricsTimeSeries(
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) {
              data {
                timestamp
                annotationSummaries {
                  name
                  meanScore
                  labelFractions {
                    label
                    fraction
                  }
                }
              }
            }
          }
        }
      }
    `,
    getQueryVariables(props, scale, utcOffsetMinutes),
    useMetricQueryFetchOptions()
  );
  return getProjectEvaluationMetricsSeries(
    data.project.spanAnnotationMetricsTimeSeries?.data ?? []
  );
}

export function TraceEvaluationMetricsGrid(props: ProjectMetricViewProps) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <TraceEvaluationMetricsGridContent {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

function TraceEvaluationMetricsGridContent(props: ProjectMetricViewProps) {
  const evaluationSeries = useTraceEvaluationMetricsSeries(props);
  return (
    <ProjectEvaluationMetricsGrid
      {...props}
      evaluationSeries={evaluationSeries}
    />
  );
}

export function useTraceEvaluationMetricsSeries(props: ProjectMetricViewProps) {
  const scale = useTimeBinScale({ timeRange: props.timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const data = useLazyLoadQuery<ProjectEvaluationMetricsGridsTraceQuery>(
    graphql`
      query ProjectEvaluationMetricsGridsTraceQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            traceAnnotationMetricsTimeSeries(
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) {
              data {
                timestamp
                annotationSummaries {
                  name
                  meanScore
                  labelFractions {
                    label
                    fraction
                  }
                }
              }
            }
          }
        }
      }
    `,
    getQueryVariables(props, scale, utcOffsetMinutes),
    useMetricQueryFetchOptions()
  );
  return getProjectEvaluationMetricsSeries(
    data.project.traceAnnotationMetricsTimeSeries?.data ?? []
  );
}

export function SessionEvaluationMetricsGrid(props: ProjectMetricViewProps) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <SessionEvaluationMetricsGridContent {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

function SessionEvaluationMetricsGridContent(props: ProjectMetricViewProps) {
  const evaluationSeries = useSessionEvaluationMetricsSeries(props);
  return (
    <ProjectEvaluationMetricsGrid
      {...props}
      evaluationSeries={evaluationSeries}
    />
  );
}

export function useSessionEvaluationMetricsSeries(
  props: ProjectMetricViewProps
) {
  const scale = useTimeBinScale({ timeRange: props.timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const data = useLazyLoadQuery<ProjectEvaluationMetricsGridsSessionQuery>(
    graphql`
      query ProjectEvaluationMetricsGridsSessionQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            sessionAnnotationMetricsTimeSeries(
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) {
              data {
                timestamp
                annotationSummaries {
                  name
                  meanScore
                  labelFractions {
                    label
                    fraction
                  }
                }
              }
            }
          }
        }
      }
    `,
    getQueryVariables(props, scale, utcOffsetMinutes),
    useMetricQueryFetchOptions()
  );
  return getProjectEvaluationMetricsSeries(
    data.project.sessionAnnotationMetricsTimeSeries?.data ?? []
  );
}

function getQueryVariables(
  { projectId, timeRange }: ProjectMetricViewProps,
  scale: TimeBinScale,
  utcOffsetMinutes: number
) {
  return {
    projectId,
    timeRange: {
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString(),
    },
    timeBinConfig: { scale, utcOffsetMinutes },
  };
}
