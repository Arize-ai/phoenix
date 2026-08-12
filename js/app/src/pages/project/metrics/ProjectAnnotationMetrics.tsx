import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Loading, Text } from "@phoenix/components";
import {
  type AnnotationOptimizationConfig,
  getPositiveOptimizationFromConfig,
} from "@phoenix/components/annotation";
import {
  AnnotationMetricsChart,
  type AnnotationMetricsSeries,
  AnnotationMetricsViewMenu,
  ChartPanel,
  ChartSkeleton,
  DeferredChartPanel,
  TimeRangeChartBrush,
  compactTimeXAxisProps,
  compactYAxisProps,
  getDefaultAnnotationMetricsView,
  normalizeAnnotationMetrics,
  useBinTimeTickFormatter,
} from "@phoenix/components/chart";
import { ErrorBoundary } from "@phoenix/components/exception";
import { useFrozenWhileHidden } from "@phoenix/hooks/useFrozenWhileHidden";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import type { MetricChartTableView } from "@phoenix/pages/project/constants";
import { PROJECT_ANNOTATION_METRIC_CHART_DESCRIPTION } from "@phoenix/pages/project/constants";

import { getNonNoteAnnotationNames } from "../spanAnnotationUtils";
import type { ProjectAnnotationMetricNamesSessionQuery } from "./__generated__/ProjectAnnotationMetricNamesSessionQuery.graphql";
import type { ProjectAnnotationMetricNamesSpanQuery } from "./__generated__/ProjectAnnotationMetricNamesSpanQuery.graphql";
import type { ProjectAnnotationMetricNamesTraceQuery } from "./__generated__/ProjectAnnotationMetricNamesTraceQuery.graphql";
import type { ProjectAnnotationMetricsSessionQuery } from "./__generated__/ProjectAnnotationMetricsSessionQuery.graphql";
import type { ProjectAnnotationMetricsSpanQuery } from "./__generated__/ProjectAnnotationMetricsSpanQuery.graphql";
import type { ProjectAnnotationMetricsTraceQuery } from "./__generated__/ProjectAnnotationMetricsTraceQuery.graphql";
import type { ProjectAnnotationMetricTimeRangeNamesSessionQuery } from "./__generated__/ProjectAnnotationMetricTimeRangeNamesSessionQuery.graphql";
import type { ProjectAnnotationMetricTimeRangeNamesSpanQuery } from "./__generated__/ProjectAnnotationMetricTimeRangeNamesSpanQuery.graphql";
import type { ProjectAnnotationMetricTimeRangeNamesTraceQuery } from "./__generated__/ProjectAnnotationMetricTimeRangeNamesTraceQuery.graphql";
import type { ProjectMetricViewProps } from "./types";
import {
  PROJECT_METRICS_CHART_SYNC_ID,
  useMetricQueryFetchOptions,
} from "./types";
import { useProjectAnnotationConfigsByName } from "./useProjectAnnotationConfigsByName";

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

type ProjectAnnotationMetricsResult = {
  annotationSeries: AnnotationMetricsSeries[];
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
};

function getProjectAnnotationMetricsSeries(
  data: AnnotationMetricsData
): AnnotationMetricsSeries[] {
  return normalizeAnnotationMetrics({
    points: data.map((point) => ({
      x: new Date(point.timestamp).getTime(),
      summaries: point.annotationSummaries,
    })),
  });
}

const annotationGridCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-200);

  /* Let an unpaired final evaluation chart consume the empty grid cell. */
  > :last-of-type:nth-of-type(odd) {
    grid-column: 1 / -1;
  }

  @container (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

function ProjectAnnotationMetricsGridView({
  annotationNames,
  annotationLevel,
  ...props
}: ProjectMetricViewProps & {
  annotationNames: ReadonlyArray<string>;
  annotationLevel: MetricChartTableView;
}) {
  if (annotationNames.length === 0) {
    return null;
  }

  return (
    <div css={annotationGridCSS}>
      {annotationNames.map((annotationName) => (
        <DeferredProjectAnnotationMetricPanel
          {...props}
          key={annotationName}
          annotationLevel={annotationLevel}
          annotationName={annotationName}
        />
      ))}
    </div>
  );
}

function ProjectAnnotationMetricsPanel({
  series,
  annotationConfig,
  timeRange,
  timeTickFormatter,
  fullTimeFormatter,
  onTimeRangeSelected,
  fillHeight = false,
}: {
  series: AnnotationMetricsSeries;
  annotationConfig?: AnnotationOptimizationConfig;
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
      subtitle={PROJECT_ANNOTATION_METRIC_CHART_DESCRIPTION}
      fillHeight={fillHeight}
      actions={
        showViewToggle ? (
          <AnnotationMetricsViewMenu view={activeView} onChange={setView} />
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
            getMeanScoreOptimization={(meanScore) =>
              getPositiveOptimizationFromConfig({
                config: annotationConfig,
                score: meanScore,
              })
            }
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

type ProjectAnnotationMetricPanelProps = ProjectMetricViewProps & {
  annotationLevel: MetricChartTableView;
  annotationName: string;
  fillHeight?: boolean;
};

function DeferredProjectAnnotationMetricPanel({
  annotationName,
  fillHeight = false,
  ...props
}: ProjectAnnotationMetricPanelProps) {
  return (
    <DeferredChartPanel
      title={annotationName}
      subtitle={PROJECT_ANNOTATION_METRIC_CHART_DESCRIPTION}
      fillHeight={fillHeight}
    >
      <ProjectAnnotationMetricPanelWithFrozenTimeRange
        {...props}
        annotationName={annotationName}
        fillHeight={fillHeight}
      />
    </DeferredChartPanel>
  );
}

// Keep live query inputs frozen while an already-mounted chart is hidden.
// This must render inside DeferredChartPanel's visibility context.
function ProjectAnnotationMetricPanelWithFrozenTimeRange({
  timeRange,
  ...props
}: ProjectAnnotationMetricPanelProps) {
  const visibleTimeRange = useFrozenWhileHidden(timeRange);
  return (
    <ProjectAnnotationMetricPanel {...props} timeRange={visibleTimeRange} />
  );
}

export function ProjectAnnotationMetricPanel({
  fillHeight = false,
  ...props
}: ProjectAnnotationMetricPanelProps) {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <ChartPanel
            title={props.annotationName}
            subtitle={PROJECT_ANNOTATION_METRIC_CHART_DESCRIPTION}
            fillHeight={fillHeight}
          >
            <ChartSkeleton />
          </ChartPanel>
        }
      >
        <ProjectAnnotationMetricsSeriesLoader {...props}>
          {({ annotationSeries, annotationConfigsByName }) => (
            <ProjectAnnotationMetricPanelContent
              {...props}
              annotationSeries={annotationSeries}
              annotationConfigsByName={annotationConfigsByName}
              fillHeight={fillHeight}
            />
          )}
        </ProjectAnnotationMetricsSeriesLoader>
      </Suspense>
    </ErrorBoundary>
  );
}

function ProjectAnnotationMetricPanelContent({
  annotationSeries,
  annotationConfigsByName,
  annotationName,
  fillHeight,
  ...props
}: ProjectMetricViewProps & {
  annotationSeries: AnnotationMetricsSeries[];
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  annotationName: string;
  fillHeight: boolean;
}) {
  const scale = useTimeBinScale({ timeRange: props.timeRange });
  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const { fullTimeFormatter } = useTimeFormatters();
  const series = annotationSeries[0] ?? {
    name: annotationName,
    views: [],
    labels: [],
    data: [],
  };
  return (
    <ProjectAnnotationMetricsPanel
      {...props}
      series={series}
      annotationConfig={annotationConfigsByName.get(series.name)}
      timeTickFormatter={timeTickFormatter}
      fullTimeFormatter={fullTimeFormatter}
      fillHeight={fillHeight}
    />
  );
}

export function ProjectAnnotationMetricsGrid({
  annotationLevel,
  ...props
}: ProjectMetricViewProps & { annotationLevel: MetricChartTableView }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <ProjectAnnotationMetricNamesLoader
          {...props}
          annotationLevel={annotationLevel}
        >
          {(annotationNames) => (
            <ProjectAnnotationMetricsGridView
              {...props}
              annotationLevel={annotationLevel}
              annotationNames={annotationNames}
            />
          )}
        </ProjectAnnotationMetricNamesLoader>
      </Suspense>
    </ErrorBoundary>
  );
}

function getSortedAnnotationNames(
  names: ReadonlyArray<string>
): ReadonlyArray<string> {
  return [...names].sort((left, right) => left.localeCompare(right));
}

export function useSpanAnnotationMetricNames(
  projectId: string
): ReadonlyArray<string> {
  const data = useLazyLoadQuery<ProjectAnnotationMetricNamesSpanQuery>(
    graphql`
      query ProjectAnnotationMetricNamesSpanQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            spanAnnotationNames
          }
        }
      }
    `,
    { projectId },
    useMetricQueryFetchOptions()
  );
  return getSortedAnnotationNames(
    getNonNoteAnnotationNames(data.project.spanAnnotationNames ?? [])
  );
}

export function useTraceAnnotationMetricNames(
  projectId: string
): ReadonlyArray<string> {
  const data = useLazyLoadQuery<ProjectAnnotationMetricNamesTraceQuery>(
    graphql`
      query ProjectAnnotationMetricNamesTraceQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            traceAnnotationsNames
          }
        }
      }
    `,
    { projectId },
    useMetricQueryFetchOptions()
  );
  return getSortedAnnotationNames(
    getNonNoteAnnotationNames(data.project.traceAnnotationsNames ?? [])
  );
}

export function useSessionAnnotationMetricNames(
  projectId: string
): ReadonlyArray<string> {
  const data = useLazyLoadQuery<ProjectAnnotationMetricNamesSessionQuery>(
    graphql`
      query ProjectAnnotationMetricNamesSessionQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            sessionAnnotationNames
          }
        }
      }
    `,
    { projectId },
    useMetricQueryFetchOptions()
  );
  return getSortedAnnotationNames(
    getNonNoteAnnotationNames(data.project.sessionAnnotationNames ?? [])
  );
}

type ProjectAnnotationMetricNamesLoaderProps = ProjectMetricViewProps & {
  annotationLevel: MetricChartTableView;
  children: (annotationNames: ReadonlyArray<string>) => ReactNode;
};

function ProjectAnnotationMetricNamesLoader({
  annotationLevel,
  ...props
}: ProjectAnnotationMetricNamesLoaderProps) {
  switch (annotationLevel) {
    case "spans":
      return <SpanAnnotationMetricNamesLoader {...props} />;
    case "traces":
      return <TraceAnnotationMetricNamesLoader {...props} />;
    case "sessions":
      return <SessionAnnotationMetricNamesLoader {...props} />;
  }
  return null;
}

function SpanAnnotationMetricNamesLoader({
  children,
  ...props
}: Omit<ProjectAnnotationMetricNamesLoaderProps, "annotationLevel">) {
  return children(useSpanAnnotationMetricTimeRangeNames(props));
}

function TraceAnnotationMetricNamesLoader({
  children,
  ...props
}: Omit<ProjectAnnotationMetricNamesLoaderProps, "annotationLevel">) {
  return children(useTraceAnnotationMetricTimeRangeNames(props));
}

function SessionAnnotationMetricNamesLoader({
  children,
  ...props
}: Omit<ProjectAnnotationMetricNamesLoaderProps, "annotationLevel">) {
  return children(useSessionAnnotationMetricTimeRangeNames(props));
}

function useSpanAnnotationMetricTimeRangeNames(
  props: ProjectMetricViewProps
): ReadonlyArray<string> {
  const data = useLazyLoadQuery<ProjectAnnotationMetricTimeRangeNamesSpanQuery>(
    graphql`
      query ProjectAnnotationMetricTimeRangeNamesSpanQuery(
        $projectId: ID!
        $timeRange: TimeRange!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            spanAnnotationMetricNames(timeRange: $timeRange)
          }
        }
      }
    `,
    getTimeRangeQueryVariables(props),
    useMetricQueryFetchOptions()
  );
  return data.project.spanAnnotationMetricNames ?? [];
}

function useTraceAnnotationMetricTimeRangeNames(
  props: ProjectMetricViewProps
): ReadonlyArray<string> {
  const data =
    useLazyLoadQuery<ProjectAnnotationMetricTimeRangeNamesTraceQuery>(
      graphql`
        query ProjectAnnotationMetricTimeRangeNamesTraceQuery(
          $projectId: ID!
          $timeRange: TimeRange!
        ) {
          project: node(id: $projectId) {
            ... on Project {
              traceAnnotationMetricNames(timeRange: $timeRange)
            }
          }
        }
      `,
      getTimeRangeQueryVariables(props),
      useMetricQueryFetchOptions()
    );
  return data.project.traceAnnotationMetricNames ?? [];
}

function useSessionAnnotationMetricTimeRangeNames(
  props: ProjectMetricViewProps
): ReadonlyArray<string> {
  const data =
    useLazyLoadQuery<ProjectAnnotationMetricTimeRangeNamesSessionQuery>(
      graphql`
        query ProjectAnnotationMetricTimeRangeNamesSessionQuery(
          $projectId: ID!
          $timeRange: TimeRange!
        ) {
          project: node(id: $projectId) {
            ... on Project {
              sessionAnnotationMetricNames(timeRange: $timeRange)
            }
          }
        }
      `,
      getTimeRangeQueryVariables(props),
      useMetricQueryFetchOptions()
    );
  return data.project.sessionAnnotationMetricNames ?? [];
}

type ProjectAnnotationMetricsQueryProps = ProjectMetricViewProps & {
  annotationName: string;
};

type ProjectAnnotationMetricsSeriesLoaderProps =
  ProjectAnnotationMetricsQueryProps & {
    annotationLevel: MetricChartTableView;
    children: (result: ProjectAnnotationMetricsResult) => ReactNode;
  };

// Keep these Relay queries below the nearest Suspense boundary. Suspending from
// the page can remount the metrics tree and repeatedly restart the query.
function ProjectAnnotationMetricsSeriesLoader({
  annotationLevel,
  ...props
}: ProjectAnnotationMetricsSeriesLoaderProps) {
  switch (annotationLevel) {
    case "spans":
      return <SpanAnnotationMetricsSeriesLoader {...props} />;
    case "traces":
      return <TraceAnnotationMetricsSeriesLoader {...props} />;
    case "sessions":
      return <SessionAnnotationMetricsSeriesLoader {...props} />;
  }
  return null;
}

function SpanAnnotationMetricsSeriesLoader({
  children,
  ...props
}: Omit<ProjectAnnotationMetricsSeriesLoaderProps, "annotationLevel">) {
  return children(useSpanAnnotationMetricsSeries(props));
}

function TraceAnnotationMetricsSeriesLoader({
  children,
  ...props
}: Omit<ProjectAnnotationMetricsSeriesLoaderProps, "annotationLevel">) {
  return children(useTraceAnnotationMetricsSeries(props));
}

function SessionAnnotationMetricsSeriesLoader({
  children,
  ...props
}: Omit<ProjectAnnotationMetricsSeriesLoaderProps, "annotationLevel">) {
  return children(useSessionAnnotationMetricsSeries(props));
}

function useSpanAnnotationMetricsSeries(
  props: ProjectAnnotationMetricsQueryProps
): ProjectAnnotationMetricsResult {
  const scale = useTimeBinScale({ timeRange: props.timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const data = useLazyLoadQuery<ProjectAnnotationMetricsSpanQuery>(
    graphql`
      query ProjectAnnotationMetricsSpanQuery(
        $projectId: ID!
        $annotationName: String!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            ...ProjectAnnotationMetricsConfigFragment
              @arguments(annotationConfigNames: [$annotationName], first: 1)
            spanAnnotationMetricsTimeSeries(
              annotationName: $annotationName
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
    getQueryVariables({ ...props, scale, utcOffsetMinutes }),
    useMetricQueryFetchOptions()
  );
  const annotationConfigsByName = useProjectAnnotationConfigsByName(
    data.project
  );
  return {
    annotationSeries: getProjectAnnotationMetricsSeries(
      data.project.spanAnnotationMetricsTimeSeries?.data ?? []
    ),
    annotationConfigsByName,
  };
}

function useTraceAnnotationMetricsSeries(
  props: ProjectAnnotationMetricsQueryProps
): ProjectAnnotationMetricsResult {
  const scale = useTimeBinScale({ timeRange: props.timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const data = useLazyLoadQuery<ProjectAnnotationMetricsTraceQuery>(
    graphql`
      query ProjectAnnotationMetricsTraceQuery(
        $projectId: ID!
        $annotationName: String!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            ...ProjectAnnotationMetricsConfigFragment
              @arguments(annotationConfigNames: [$annotationName], first: 1)
            traceAnnotationMetricsTimeSeries(
              annotationName: $annotationName
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
    getQueryVariables({ ...props, scale, utcOffsetMinutes }),
    useMetricQueryFetchOptions()
  );
  const annotationConfigsByName = useProjectAnnotationConfigsByName(
    data.project
  );
  return {
    annotationSeries: getProjectAnnotationMetricsSeries(
      data.project.traceAnnotationMetricsTimeSeries?.data ?? []
    ),
    annotationConfigsByName,
  };
}

function useSessionAnnotationMetricsSeries(
  props: ProjectAnnotationMetricsQueryProps
): ProjectAnnotationMetricsResult {
  const scale = useTimeBinScale({ timeRange: props.timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const data = useLazyLoadQuery<ProjectAnnotationMetricsSessionQuery>(
    graphql`
      query ProjectAnnotationMetricsSessionQuery(
        $projectId: ID!
        $annotationName: String!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            ...ProjectAnnotationMetricsConfigFragment
              @arguments(annotationConfigNames: [$annotationName], first: 1)
            sessionAnnotationMetricsTimeSeries(
              annotationName: $annotationName
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
    getQueryVariables({ ...props, scale, utcOffsetMinutes }),
    useMetricQueryFetchOptions()
  );
  const annotationConfigsByName = useProjectAnnotationConfigsByName(
    data.project
  );
  return {
    annotationSeries: getProjectAnnotationMetricsSeries(
      data.project.sessionAnnotationMetricsTimeSeries?.data ?? []
    ),
    annotationConfigsByName,
  };
}

function getQueryVariables({
  projectId,
  annotationName,
  timeRange,
  scale,
  utcOffsetMinutes,
}: ProjectAnnotationMetricsQueryProps & {
  scale: TimeBinScale;
  utcOffsetMinutes: number;
}) {
  return {
    ...getTimeRangeQueryVariables({ projectId, timeRange }),
    annotationName,
    timeBinConfig: { scale, utcOffsetMinutes },
  };
}

function getTimeRangeQueryVariables({
  projectId,
  timeRange,
}: Pick<ProjectMetricViewProps, "projectId" | "timeRange">) {
  return {
    projectId,
    timeRange: {
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString(),
    },
  };
}
