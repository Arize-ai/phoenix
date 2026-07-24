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
import type { MetricChartTableView } from "@phoenix/pages/project/constants";
import { PROJECT_ANNOTATION_METRIC_CHART_DESCRIPTION } from "@phoenix/pages/project/constants";

import { getNonNoteAnnotationNames } from "../spanAnnotationUtils";
import type { ProjectAnnotationMetricNamesSessionQuery } from "./__generated__/ProjectAnnotationMetricNamesSessionQuery.graphql";
import type { ProjectAnnotationMetricNamesSpanQuery } from "./__generated__/ProjectAnnotationMetricNamesSpanQuery.graphql";
import type { ProjectAnnotationMetricNamesTraceQuery } from "./__generated__/ProjectAnnotationMetricNamesTraceQuery.graphql";
import type { ProjectAnnotationMetricsSessionQuery } from "./__generated__/ProjectAnnotationMetricsSessionQuery.graphql";
import type { ProjectAnnotationMetricsSpanQuery } from "./__generated__/ProjectAnnotationMetricsSpanQuery.graphql";
import type { ProjectAnnotationMetricsTraceQuery } from "./__generated__/ProjectAnnotationMetricsTraceQuery.graphql";
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

function getProjectAnnotationMetricsSeries({
  data,
  annotationName,
}: {
  data: AnnotationMetricsData;
  annotationName?: string;
}): AnnotationMetricsSeries[] {
  return normalizeAnnotationMetrics({
    points: data.map((point) => ({
      x: new Date(point.timestamp).getTime(),
      summaries:
        annotationName == null
          ? point.annotationSummaries
          : point.annotationSummaries.filter(
              (summary) => summary.name === annotationName
            ),
    })),
  });
}

const annotationGridCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-200);

  @container (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

function ProjectAnnotationMetricsGridView({
  annotationSeries,
  timeRange,
  onTimeRangeSelected,
}: {
  annotationSeries: AnnotationMetricsSeries[];
  timeRange: TimeRange;
  onTimeRangeSelected?: (timeRange: TimeRange) => void;
}) {
  const scale = useTimeBinScale({ timeRange });
  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const { fullTimeFormatter } = useTimeFormatters();
  if (annotationSeries.length === 0) {
    return null;
  }

  return (
    <div css={annotationGridCSS}>
      {annotationSeries.map((series) => (
        <ProjectAnnotationMetricsPanel
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

function ProjectAnnotationMetricsPanel({
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
      subtitle={PROJECT_ANNOTATION_METRIC_CHART_DESCRIPTION}
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

type ProjectAnnotationMetricPanelProps = ProjectMetricViewProps & {
  annotationLevel: MetricChartTableView;
  annotationName: string;
  fillHeight?: boolean;
};

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
            <Loading />
          </ChartPanel>
        }
      >
        <ProjectAnnotationMetricsSeriesLoader {...props}>
          {(annotationSeries) => (
            <ProjectAnnotationMetricPanelContent
              {...props}
              annotationSeries={annotationSeries}
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
  annotationName,
  fillHeight,
  ...props
}: ProjectMetricViewProps & {
  annotationSeries: AnnotationMetricsSeries[];
  annotationName: string;
  fillHeight: boolean;
}) {
  const scale = useTimeBinScale({ timeRange: props.timeRange });
  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const { fullTimeFormatter } = useTimeFormatters();
  const series =
    annotationSeries[0] ?? getEmptyAnnotationMetricsSeries(annotationName);
  return (
    <ProjectAnnotationMetricsPanel
      {...props}
      series={series}
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
        <ProjectAnnotationMetricsSeriesLoader
          {...props}
          annotationLevel={annotationLevel}
        >
          {(annotationSeries) => (
            <ProjectAnnotationMetricsGridView
              {...props}
              annotationSeries={annotationSeries}
            />
          )}
        </ProjectAnnotationMetricsSeriesLoader>
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

type ProjectAnnotationMetricsQueryProps = ProjectMetricViewProps & {
  annotationName?: string;
};

type ProjectAnnotationMetricsSeriesLoaderProps =
  ProjectAnnotationMetricsQueryProps & {
    annotationLevel: MetricChartTableView;
    children: (annotationSeries: AnnotationMetricsSeries[]) => ReactNode;
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
) {
  const scale = useTimeBinScale({ timeRange: props.timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const data = useLazyLoadQuery<ProjectAnnotationMetricsSpanQuery>(
    graphql`
      query ProjectAnnotationMetricsSpanQuery(
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
    getQueryVariables({ ...props, scale, utcOffsetMinutes }),
    useMetricQueryFetchOptions()
  );
  return getProjectAnnotationMetricsSeries({
    data: data.project.spanAnnotationMetricsTimeSeries?.data ?? [],
    annotationName: props.annotationName,
  });
}

function useTraceAnnotationMetricsSeries(
  props: ProjectAnnotationMetricsQueryProps
) {
  const scale = useTimeBinScale({ timeRange: props.timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const data = useLazyLoadQuery<ProjectAnnotationMetricsTraceQuery>(
    graphql`
      query ProjectAnnotationMetricsTraceQuery(
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
    getQueryVariables({ ...props, scale, utcOffsetMinutes }),
    useMetricQueryFetchOptions()
  );
  return getProjectAnnotationMetricsSeries({
    data: data.project.traceAnnotationMetricsTimeSeries?.data ?? [],
    annotationName: props.annotationName,
  });
}

function useSessionAnnotationMetricsSeries(
  props: ProjectAnnotationMetricsQueryProps
) {
  const scale = useTimeBinScale({ timeRange: props.timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const data = useLazyLoadQuery<ProjectAnnotationMetricsSessionQuery>(
    graphql`
      query ProjectAnnotationMetricsSessionQuery(
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
    getQueryVariables({ ...props, scale, utcOffsetMinutes }),
    useMetricQueryFetchOptions()
  );
  return getProjectAnnotationMetricsSeries({
    data: data.project.sessionAnnotationMetricsTimeSeries?.data ?? [],
    annotationName: props.annotationName,
  });
}

function getQueryVariables({
  projectId,
  timeRange,
  scale,
  utcOffsetMinutes,
}: ProjectMetricViewProps & {
  scale: TimeBinScale;
  utcOffsetMinutes: number;
}) {
  return {
    projectId,
    timeRange: {
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString(),
    },
    timeBinConfig: { scale, utcOffsetMinutes },
  };
}
