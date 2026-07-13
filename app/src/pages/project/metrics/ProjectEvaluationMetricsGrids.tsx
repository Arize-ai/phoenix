import { css } from "@emotion/react";
import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Loading, Text } from "@phoenix/components";
import {
  ChartPanel,
  EvaluationMetricsChart,
  TimeRangeChartBrush,
  compactTimeXAxisProps,
  compactYAxisProps,
  normalizeEvaluationMetrics,
  useBinTimeTickFormatter,
} from "@phoenix/components/chart";
import { ErrorBoundary } from "@phoenix/components/exception";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";

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
    readonly count: number;
    readonly scoreCount: number;
    readonly labelCount: number;
    readonly meanScore: number | null;
    readonly labelFractions: ReadonlyArray<{
      readonly label: string;
      readonly fraction: number;
    }>;
  }>;
}>;

const evaluationGridCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-200);

  @container (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

function ProjectEvaluationMetricsGrid({
  data,
  timeRange,
  onTimeRangeSelected,
}: {
  data: AnnotationMetricsData;
  timeRange: TimeRange;
  onTimeRangeSelected?: (timeRange: TimeRange) => void;
}) {
  const scale = useTimeBinScale({ timeRange });
  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const { fullTimeFormatter } = useTimeFormatters();
  const evaluationSeries = useMemo(
    () =>
      normalizeEvaluationMetrics(
        data.map((point) => ({
          x: new Date(point.timestamp).getTime(),
          summaries: point.annotationSummaries,
        }))
      ),
    [data]
  );

  if (evaluationSeries.length === 0) {
    return null;
  }

  return (
    <div css={evaluationGridCSS} data-testid="project-evaluation-grid">
      {evaluationSeries.map((series) => (
        <ChartPanel
          key={series.name}
          title={series.name}
          subtitle="Evaluation results over time"
        >
          <TimeRangeChartBrush onTimeRangeSelected={onTimeRangeSelected}>
            {({ chartProps }) => (
              <EvaluationMetricsChart
                series={series}
                xAxisProps={{
                  ...compactTimeXAxisProps,
                  dataKey: "x",
                  domain: [timeRange.start.getTime(), timeRange.end.getTime()],
                  tickFormatter: (value) =>
                    timeTickFormatter(new Date(Number(value))),
                }}
                yAxisProps={compactYAxisProps}
                syncId={PROJECT_METRICS_CHART_SYNC_ID}
                barChartProps={chartProps}
                renderTooltipHeader={(point) => (
                  <Text weight="heavy" size="S">
                    {fullTimeFormatter(new Date(point.x))}
                  </Text>
                )}
              />
            )}
          </TimeRangeChartBrush>
        </ChartPanel>
      ))}
    </div>
  );
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
                  count
                  scoreCount
                  labelCount
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
  return (
    <ProjectEvaluationMetricsGrid
      {...props}
      data={data.project.spanAnnotationMetricsTimeSeries?.data ?? []}
    />
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
                  count
                  scoreCount
                  labelCount
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
  return (
    <ProjectEvaluationMetricsGrid
      {...props}
      data={data.project.traceAnnotationMetricsTimeSeries?.data ?? []}
    />
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
                  count
                  scoreCount
                  labelCount
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
  return (
    <ProjectEvaluationMetricsGrid
      {...props}
      data={data.project.sessionAnnotationMetricsTimeSeries?.data ?? []}
    />
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
