import { css } from "@emotion/react";
import type { ComponentProps, ReactNode } from "react";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Flex,
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import {
  getOptimizationBounds,
  getPositiveOptimizationFromConfig,
} from "@phoenix/components/annotation";
import { MeanScore } from "@phoenix/components/annotation/MeanScore";
import { Sparkline } from "@phoenix/components/chart";
import { SummaryValueBreakdown } from "@phoenix/pages/project/AnnotationSummary";
import type { EvaluationTarget } from "@phoenix/pages/project/evaluators/__generated__/createProjectLlmEvaluatorMutation.graphql";
import type { ProjectEvaluatorMeanScoreCellSessionQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorMeanScoreCellSessionQuery.graphql";
import type { ProjectEvaluatorMeanScoreCellSpanQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorMeanScoreCellSpanQuery.graphql";
import type { ProjectEvaluatorMeanScoreCellTraceQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorMeanScoreCellTraceQuery.graphql";
import type { ProjectEvaluatorResultAnnotation } from "@phoenix/pages/project/evaluators/useProjectEvaluatorResultAnnotations";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

/**
 * The closed windows and binning the mean score cells aggregate over, derived
 * once per table render so every row's query shares identical variables.
 */
export type EvaluatorScoreWindow = {
  /** The page time range clamped to the score window cap, as ISO strings. */
  timeRange: { start: string; end: string };
  /** The equal-length window immediately before, for the delta. */
  previousTimeRange: { start: string; end: string };
  timeBinConfig: { scale: TimeBinScale; utcOffsetMinutes: number };
  /** Compact label of the window length, e.g. "7d". */
  windowKey: string;
};

type AnnotationSummaryData = {
  readonly meanScore: number | null | undefined;
  readonly count: number;
  readonly scoreCount: number;
  readonly labelCount: number;
  readonly labelFractions: ReadonlyArray<{
    readonly label: string;
    readonly fraction: number;
  }>;
};

type SeriesData = {
  readonly data: ReadonlyArray<{
    readonly annotationSummaries: ReadonlyArray<{
      readonly name: string;
      readonly meanScore: number | null | undefined;
    }>;
  }>;
};

type AnnotationMeanScoreLoaderProps = {
  /** The evaluated project the evaluator's annotations land on. */
  projectId: string;
  annotation: ProjectEvaluatorResultAnnotation;
  scoreWindow: EvaluatorScoreWindow;
};

const meanScoreAlignmentCSS = css`
  /* AnnotationScoreText insets a directed score as a padded pill; mirror
     that inset for undirected and fallback scores so the values start at
     the same x position on every row of the column. */
  > .text:not([data-direction]) {
    display: inline-block;
    padding: var(--global-dimension-size-25) var(--global-dimension-size-100);
  }
`;

/** Aligns a score with the pill-shaped scores on neighboring rows. */
function AlignedScore({ children }: { children: ReactNode }) {
  return <span css={meanScoreAlignmentCSS}>{children}</span>;
}

function CellMeanScore(props: ComponentProps<typeof MeanScore>) {
  return (
    <AlignedScore>
      <MeanScore {...props} />
    </AlignedScore>
  );
}

const meanScoreFallback = (
  <AlignedScore>
    <Text fontFamily="mono" color="text-700">
      --
    </Text>
  </AlignedScore>
);

/**
 * The evaluators table's mean score cell: for each annotation the evaluator
 * writes, the mean score over the (clamped) page time range, its change vs.
 * the previous window, and a sparkline of per-bin means. Fetches its own data,
 * so the aggregates are only queried while the column is visible.
 */
export function ProjectEvaluatorMeanScoreCell({
  projectId,
  evaluationTarget,
  annotations,
  scoreWindow,
}: {
  /** The evaluated project the evaluator's annotations land on. */
  projectId: string;
  evaluationTarget: EvaluationTarget;
  /** The annotations the evaluator writes, named the way its runs persist them. */
  annotations: ReadonlyArray<ProjectEvaluatorResultAnnotation>;
  scoreWindow: EvaluatorScoreWindow;
}) {
  return (
    <Flex direction="column" gap="size-50">
      {annotations.map((annotation) => (
        <Suspense key={annotation.name} fallback={meanScoreFallback}>
          <AnnotationMeanScoreLoader
            projectId={projectId}
            evaluationTarget={evaluationTarget}
            annotation={annotation}
            scoreWindow={scoreWindow}
          />
        </Suspense>
      ))}
    </Flex>
  );
}

/**
 * Routes to the summary fields for the level the evaluator annotates at,
 * mirroring the level switch in ProjectAnnotationMetrics.
 */
function AnnotationMeanScoreLoader({
  evaluationTarget,
  ...props
}: AnnotationMeanScoreLoaderProps & { evaluationTarget: EvaluationTarget }) {
  switch (evaluationTarget) {
    case "SPAN":
      return <SpanAnnotationMeanScore {...props} />;
    case "TRACE":
      return <TraceAnnotationMeanScore {...props} />;
    case "SESSION":
      return <SessionAnnotationMeanScore {...props} />;
    default:
      return meanScoreFallback;
  }
}

function getQueryVariables({
  projectId,
  annotation,
  scoreWindow,
}: AnnotationMeanScoreLoaderProps) {
  return {
    projectId,
    annotationName: annotation.name,
    timeRange: scoreWindow.timeRange,
    previousTimeRange: scoreWindow.previousTimeRange,
    timeBinConfig: scoreWindow.timeBinConfig,
  };
}

function SpanAnnotationMeanScore(props: AnnotationMeanScoreLoaderProps) {
  const data = useLazyLoadQuery<ProjectEvaluatorMeanScoreCellSpanQuery>(
    graphql`
      query ProjectEvaluatorMeanScoreCellSpanQuery(
        $projectId: ID!
        $annotationName: String!
        $timeRange: TimeRange!
        $previousTimeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            summary: spanAnnotationSummary(
              annotationName: $annotationName
              timeRange: $timeRange
            ) {
              meanScore
              count
              scoreCount
              labelCount
              labelFractions {
                label
                fraction
              }
            }
            previousSummary: spanAnnotationSummary(
              annotationName: $annotationName
              timeRange: $previousTimeRange
            ) {
              meanScore
            }
            series: spanAnnotationMetricsTimeSeries(
              annotationName: $annotationName
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) {
              data {
                annotationSummaries {
                  name
                  meanScore
                }
              }
            }
          }
        }
      }
    `,
    getQueryVariables(props)
  );
  return (
    <AnnotationMeanScoreView
      annotation={props.annotation}
      windowKey={props.scoreWindow.windowKey}
      summary={data.project.summary}
      previousMeanScore={data.project.previousSummary?.meanScore}
      series={data.project.series}
    />
  );
}

function TraceAnnotationMeanScore(props: AnnotationMeanScoreLoaderProps) {
  const data = useLazyLoadQuery<ProjectEvaluatorMeanScoreCellTraceQuery>(
    graphql`
      query ProjectEvaluatorMeanScoreCellTraceQuery(
        $projectId: ID!
        $annotationName: String!
        $timeRange: TimeRange!
        $previousTimeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            summary: traceAnnotationSummary(
              annotationName: $annotationName
              timeRange: $timeRange
            ) {
              meanScore
              count
              scoreCount
              labelCount
              labelFractions {
                label
                fraction
              }
            }
            previousSummary: traceAnnotationSummary(
              annotationName: $annotationName
              timeRange: $previousTimeRange
            ) {
              meanScore
            }
            series: traceAnnotationMetricsTimeSeries(
              annotationName: $annotationName
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) {
              data {
                annotationSummaries {
                  name
                  meanScore
                }
              }
            }
          }
        }
      }
    `,
    getQueryVariables(props)
  );
  return (
    <AnnotationMeanScoreView
      annotation={props.annotation}
      windowKey={props.scoreWindow.windowKey}
      summary={data.project.summary}
      previousMeanScore={data.project.previousSummary?.meanScore}
      series={data.project.series}
    />
  );
}

function SessionAnnotationMeanScore(props: AnnotationMeanScoreLoaderProps) {
  const data = useLazyLoadQuery<ProjectEvaluatorMeanScoreCellSessionQuery>(
    graphql`
      query ProjectEvaluatorMeanScoreCellSessionQuery(
        $projectId: ID!
        $annotationName: String!
        $timeRange: TimeRange!
        $previousTimeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            summary: sessionAnnotationSummary(
              annotationName: $annotationName
              timeRange: $timeRange
            ) {
              meanScore
              count
              scoreCount
              labelCount
              labelFractions {
                label
                fraction
              }
            }
            previousSummary: sessionAnnotationSummary(
              annotationName: $annotationName
              timeRange: $previousTimeRange
            ) {
              meanScore
            }
            series: sessionAnnotationMetricsTimeSeries(
              annotationName: $annotationName
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) {
              data {
                annotationSummaries {
                  name
                  meanScore
                }
              }
            }
          }
        }
      }
    `,
    getQueryVariables(props)
  );
  return (
    <AnnotationMeanScoreView
      annotation={props.annotation}
      windowKey={props.scoreWindow.windowKey}
      summary={data.project.summary}
      previousMeanScore={data.project.previousSummary?.meanScore}
      series={data.project.series}
    />
  );
}

function AnnotationMeanScoreView({
  annotation,
  windowKey,
  summary,
  previousMeanScore,
  series,
}: {
  annotation: ProjectEvaluatorResultAnnotation;
  windowKey: string;
  summary: AnnotationSummaryData | null | undefined;
  previousMeanScore: number | null | undefined;
  series: SeriesData | null | undefined;
}) {
  const meanScore = summary?.meanScore;
  const hasScore = typeof meanScore === "number";
  const hasLabels = (summary?.labelFractions.length ?? 0) > 0;
  if (!hasScore && !hasLabels) {
    return meanScoreFallback;
  }
  const delta =
    hasScore && typeof previousMeanScore === "number"
      ? meanScore - previousMeanScore
      : null;
  const { optimizationDirection } = getOptimizationBounds(annotation.config);
  // Positive when the change moves the score in the direction the annotation
  // optimizes for; unknowable without a direction or with no change.
  const isImprovement =
    delta == null || delta === 0 || optimizationDirection == null
      ? null
      : optimizationDirection === "MAXIMIZE"
        ? delta > 0
        : delta < 0;
  const deltaText =
    delta == null
      ? null
      : `${delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} ${formatFloat(Math.abs(delta))}`;
  const sparkValues =
    series?.data.map((point) => {
      const binSummary = point.annotationSummaries.find(
        (annotationSummary) => annotationSummary.name === annotation.name
      );
      return typeof binSummary?.meanScore === "number"
        ? binSummary.meanScore
        : null;
    }) ?? [];
  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap>
        <Flex direction="row" alignItems="center" gap="size-100" minWidth={0}>
          <CellMeanScore
            value={meanScore}
            positiveOptimization={getPositiveOptimizationFromConfig({
              config: annotation.config,
              score: meanScore,
            })}
          />
          {deltaText != null ? (
            <Text
              size="XS"
              fontFamily="mono"
              flex="none"
              color={
                isImprovement == null
                  ? "text-500"
                  : isImprovement
                    ? "success"
                    : "danger"
              }
            >
              {deltaText}
            </Text>
          ) : null}
          <Sparkline
            values={sparkValues}
            aria-label={`Mean ${annotation.name} score over the last ${windowKey}`}
            color={
              isImprovement == null
                ? "var(--global-color-gray-500)"
                : isImprovement
                  ? "var(--global-color-success)"
                  : "var(--global-color-danger)"
            }
          />
        </Flex>
      </TriggerWrap>
      <RichTooltip placement="bottom">
        <Flex direction="column" gap="size-50">
          <SummaryValueBreakdown
            annotationName={annotation.name}
            labelFractions={summary?.labelFractions}
            meanScore={meanScore}
            annotationConfig={annotation.config}
            count={summary?.count}
            scoreCount={summary?.scoreCount}
            labelCount={summary?.labelCount}
          />
          {deltaText != null ? (
            <Text size="S" color="text-700">
              {deltaText} vs. the previous {windowKey}
            </Text>
          ) : null}
        </Flex>
      </RichTooltip>
    </TooltipTrigger>
  );
}
