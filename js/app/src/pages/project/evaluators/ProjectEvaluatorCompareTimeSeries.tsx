import { css } from "@emotion/react";
import { Suspense, type ReactNode } from "react";
import { graphql, useFragment, useLazyLoadQuery } from "react-relay";
import { useSearchParams } from "react-router";

import { Card, ColorSwatch, Text } from "@phoenix/components";
import {
  type AnnotationOptimizationConfig,
  getOptimizationBounds,
  getPositiveOptimizationFromConfig,
  toAnnotationOptimizationConfig,
} from "@phoenix/components/annotation";
import {
  AnnotationMetricsGroupedChart,
  ChartSkeleton,
  compactTimeXAxisProps,
  compactYAxisProps,
  TimeRangeChartBrush,
  useBinTimeTickFormatter,
} from "@phoenix/components/chart";
import {
  type AnnotationMetricsSeries,
  type AnnotationSummary,
  normalizeAnnotationMetrics,
} from "@phoenix/components/chart/annotationMetricsUtils";
import { getTimeBinRange } from "@phoenix/components/chart/timeBins";
import { useTimeRange } from "@phoenix/components/datetime";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";

import type { ProjectEvaluatorCompareTimeSeries_comparison$key } from "./__generated__/ProjectEvaluatorCompareTimeSeries_comparison.graphql";
import type { ProjectEvaluatorCompareTimeSeries_evaluator$key } from "./__generated__/ProjectEvaluatorCompareTimeSeries_evaluator.graphql";
import type { ProjectEvaluatorCompareTimeSeriesQuery } from "./__generated__/ProjectEvaluatorCompareTimeSeriesQuery.graphql";
import {
  getCompareLabelSegments,
  getCompareTimeSeriesView,
  getCompareTimeSeriesViews,
} from "./projectEvaluatorCompareTimeSeriesUtils";
import {
  EVALUATOR_COMPARE_COLORS,
  EVALUATOR_COMPARE_HUES,
} from "./projectEvaluatorCompareUtils";
import {
  COMPARE_CHART_MARGIN,
  compareChartFooterCSS,
  compareChartToolbarCSS,
  ProjectEvaluatorCompareViewToggle,
} from "./ProjectEvaluatorCompareViewToggle";

const VIEW_PARAM = "timeSeriesView";

const panelCSS = css`
  min-width: 0;
  height: 100%;
  .card__body {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-200);
    min-height: 0;
  }
  .evaluator-time-series__plot {
    flex: 1;
    min-height: 0;
  }
  .evaluator-time-series__legend {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--global-dimension-size-200);
  }
  /* A single line per side whatever the view, so the plot keeps the height
     the distributions' plots have; long names and labels truncate instead
     (each keeps its full text as a title, and the tooltip lists them all). */
  .evaluator-time-series__legend-side {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
    overflow: hidden;
  }
  .evaluator-time-series__legend-side[data-side="b"] {
    justify-content: flex-end;
  }
  .evaluator-time-series__legend-item {
    display: flex;
    flex: 0 1 auto;
    align-items: center;
    gap: var(--global-dimension-size-50);
    min-width: 0;
  }
  .evaluator-time-series__legend-item .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const comparisonFragment = graphql`
  fragment ProjectEvaluatorCompareTimeSeries_comparison on ProjectEvaluatorComparison {
    evaluationTarget
    a {
      annotationName
    }
    b {
      annotationName
    }
  }
`;

const evaluatorFragment = graphql`
  fragment ProjectEvaluatorCompareTimeSeries_evaluator on ProjectEvaluator {
    name
    evaluator {
      outputConfigs {
        ... on AnnotationConfigBase {
          annotationType
        }
        ... on CategoricalAnnotationConfig {
          optimizationDirection
          values {
            label
            score
          }
        }
        ... on ContinuousAnnotationConfig {
          optimizationDirection
          lowerBound
          upperBound
        }
        ... on FreeformAnnotationConfig {
          optimizationDirection
          threshold
          lowerBound
          upperBound
        }
      }
    }
  }
`;

type CompareSide = {
  key: "a" | "b";
  name: string;
  color: string;
  annotationName: string;
  config: AnnotationOptimizationConfig | undefined;
};

/**
 * Both evaluators' results binned over the selected time range: mean scores
 * on independent axes (left for A, right for B), or label shares as paired
 * stacked bars. Covers every result each evaluator wrote, not just the
 * targets both evaluated.
 */
export function ProjectEvaluatorCompareTimeSeries({
  projectId,
  timeRange,
  comparisonRef,
  evaluatorARef,
  evaluatorBRef,
}: {
  projectId: string;
  timeRange: TimeRange;
  comparisonRef: ProjectEvaluatorCompareTimeSeries_comparison$key;
  evaluatorARef: ProjectEvaluatorCompareTimeSeries_evaluator$key;
  evaluatorBRef: ProjectEvaluatorCompareTimeSeries_evaluator$key;
}) {
  const comparison = useFragment(comparisonFragment, comparisonRef);
  const evaluatorA = useFragment(evaluatorFragment, evaluatorARef);
  const evaluatorB = useFragment(evaluatorFragment, evaluatorBRef);
  const toSide = (
    key: CompareSide["key"],
    evaluator: typeof evaluatorA
  ): CompareSide => ({
    key,
    name: evaluator.name,
    color: EVALUATOR_COMPARE_COLORS[key],
    annotationName: comparison[key].annotationName,
    config: toAnnotationOptimizationConfig(
      evaluator.evaluator.outputConfigs[0] ?? {}
    ),
  });
  const sides: [CompareSide, CompareSide] = [
    toSide("a", evaluatorA),
    toSide("b", evaluatorB),
  ];
  return (
    <div css={panelCSS}>
      <Suspense
        fallback={
          <TimeSeriesCard title="Scores over time">
            <div css={compareChartToolbarCSS} />
            <div className="evaluator-time-series__plot">
              <ChartSkeleton />
            </div>
          </TimeSeriesCard>
        }
      >
        <ProjectEvaluatorCompareTimeSeriesChart
          projectId={projectId}
          timeRange={timeRange}
          evaluationTarget={comparison.evaluationTarget}
          sides={sides}
        />
      </Suspense>
    </div>
  );
}

function TimeSeriesCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card title={title} height="100%" titleSeparator={false}>
      {children}
    </Card>
  );
}

function ProjectEvaluatorCompareTimeSeriesChart({
  projectId,
  timeRange,
  evaluationTarget,
  sides,
}: {
  projectId: string;
  timeRange: TimeRange;
  evaluationTarget: "SPAN" | "TRACE" | "SESSION";
  sides: [CompareSide, CompareSide];
}) {
  const [sideA, sideB] = sides;
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const { setCustomTimeRange } = useTimeRange();
  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const [searchParams, setSearchParams] = useSearchParams();
  const { timeRangeFormatter } = useTimeFormatters();
  const data = useLazyLoadQuery<ProjectEvaluatorCompareTimeSeriesQuery>(
    graphql`
      query ProjectEvaluatorCompareTimeSeriesQuery(
        $projectId: ID!
        $annotationNameA: String!
        $annotationNameB: String!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
        $isSpan: Boolean!
        $isTrace: Boolean!
        $isSession: Boolean!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            spanA: spanAnnotationMetricsTimeSeries(
              annotationName: $annotationNameA
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) @include(if: $isSpan) {
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
            spanB: spanAnnotationMetricsTimeSeries(
              annotationName: $annotationNameB
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) @include(if: $isSpan) {
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
            traceA: traceAnnotationMetricsTimeSeries(
              annotationName: $annotationNameA
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) @include(if: $isTrace) {
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
            traceB: traceAnnotationMetricsTimeSeries(
              annotationName: $annotationNameB
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) @include(if: $isTrace) {
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
            sessionA: sessionAnnotationMetricsTimeSeries(
              annotationName: $annotationNameA
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) @include(if: $isSession) {
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
            sessionB: sessionAnnotationMetricsTimeSeries(
              annotationName: $annotationNameB
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) @include(if: $isSession) {
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
    {
      projectId,
      annotationNameA: sideA.annotationName,
      annotationNameB: sideB.annotationName,
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
      timeBinConfig: { scale, utcOffsetMinutes },
      isSpan: evaluationTarget === "SPAN",
      isTrace: evaluationTarget === "TRACE",
      isSession: evaluationTarget === "SESSION",
    },
    { fetchPolicy: "store-and-network" }
  );
  const project = data.project;
  const seriesA = toSeries({
    annotationName: sideA.annotationName,
    data:
      project.spanA?.data ??
      project.traceA?.data ??
      project.sessionA?.data ??
      [],
  });
  const seriesB = toSeries({
    annotationName: sideB.annotationName,
    data:
      project.spanB?.data ??
      project.traceB?.data ??
      project.sessionB?.data ??
      [],
  });
  const views = getCompareTimeSeriesViews([seriesA, seriesB]);
  const view = getCompareTimeSeriesView({
    views,
    requested: searchParams.get(VIEW_PARAM),
  });
  const groups = sides.map((side) => {
    const series = side.key === "a" ? seriesA : seriesB;
    return {
      ...side,
      series,
      segments: getCompareLabelSegments({
        labels: series?.labels ?? [],
        hue: EVALUATOR_COMPARE_HUES[side.key],
        config: side.config,
      }),
      // A side only draws in the views its own results support.
      isVisible: series?.views.includes(view) ?? false,
    };
  });

  return (
    <TimeSeriesCard
      title={view === "scores" ? "Scores over time" : "Labels over time"}
    >
      <div css={compareChartToolbarCSS}>
        {/* Keeps the toggle where the distributions put theirs */}
        <span />
        <ProjectEvaluatorCompareViewToggle
          aria-label="Time series view"
          view={view}
          availableViews={views}
          onViewChange={(next) =>
            setSearchParams(
              (previous) => {
                const params = new URLSearchParams(previous);
                params.set(VIEW_PARAM, next);
                return params;
              },
              { replace: true }
            )
          }
        />
      </div>
      <div className="evaluator-time-series__plot">
        <TimeRangeChartBrush
          onTimeRangeSelected={setCustomTimeRange}
          scale={scale}
        >
          {({ chartProps }) => (
            <AnnotationMetricsGroupedChart
              groups={groups.map((group) => ({
                ...group,
                scoreAxisProps: {
                  domain: getScoreDomain(group.config),
                  style: { ...compactYAxisProps.style, fill: group.color },
                },
                getMeanScoreOptimization: (meanScore) =>
                  getPositiveOptimizationFromConfig({
                    config: group.config,
                    score: meanScore,
                  }),
              }))}
              view={view}
              xAxisProps={{
                ...compactTimeXAxisProps,
                dataKey: "x",
                domain: [timeRange.start.getTime(), timeRange.end.getTime()],
                tickFormatter: (value) =>
                  timeTickFormatter(new Date(Number(value))),
              }}
              yAxisProps={compactYAxisProps}
              renderTooltipHeader={(x) => (
                <Text weight="heavy" size="S">
                  {timeRangeFormatter(
                    getTimeBinRange({
                      binStartMs: x,
                      scale,
                      utcOffsetMinutes,
                    })
                  )}
                </Text>
              )}
              chartProps={{ ...chartProps, margin: COMPARE_CHART_MARGIN }}
              emptyStateMessage="No results in this time range"
            />
          )}
        </TimeRangeChartBrush>
      </div>
      {/* One line per side, like the axis rows under the distributions, so
          the plots line up; the side's column says which bar is whose. */}
      <div
        css={compareChartFooterCSS}
        className="evaluator-time-series__legend"
      >
        {groups.map((side) => (
          <div
            key={side.key}
            className="evaluator-time-series__legend-side"
            data-side={side.key}
          >
            <div className="evaluator-time-series__legend-item">
              {view === "scores" ? (
                <ColorSwatch color={side.color} size="M" />
              ) : null}
              <Text
                size="XS"
                weight={view === "labels" ? "heavy" : undefined}
                title={side.name}
              >
                {side.name}
              </Text>
              {view === "scores" ? (
                <Text size="XS" color="text-700">
                  {side.key === "a" ? "· left axis" : "· right axis"}
                </Text>
              ) : null}
            </div>
            {view === "labels" && side.isVisible
              ? side.segments.map((segment) => (
                  <div
                    key={segment.index}
                    className="evaluator-time-series__legend-item"
                  >
                    <ColorSwatch color={segment.color} size="M" />
                    <Text size="XS" color="text-700" title={segment.label}>
                      {segment.label}
                    </Text>
                  </div>
                ))
              : null}
          </div>
        ))}
      </div>
    </TimeSeriesCard>
  );
}

function toSeries({
  annotationName,
  data,
}: {
  annotationName: string;
  data: ReadonlyArray<{
    readonly timestamp: string;
    readonly annotationSummaries: ReadonlyArray<AnnotationSummary>;
  }>;
}): AnnotationMetricsSeries | undefined {
  return normalizeAnnotationMetrics({
    points: data.map((point) => ({
      x: new Date(point.timestamp).getTime(),
      summaries: point.annotationSummaries,
    })),
  }).find(({ name }) => name === annotationName);
}

/** The configured score bounds, so each axis spans its evaluator's scale. */
function getScoreDomain(
  config: AnnotationOptimizationConfig | undefined
): [number | "auto", number | "auto"] {
  const { lowerBound, upperBound } = getOptimizationBounds(config);
  return lowerBound != null && upperBound != null && lowerBound < upperBound
    ? [lowerBound, upperBound]
    : ["auto", "auto"];
}
