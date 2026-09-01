import { css } from "@emotion/react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useContext } from "react";
import invariant from "tiny-invariant";

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
import { Sparkline, useBinTimeTickFormatter } from "@phoenix/components/chart";
import { SummaryValueBreakdown } from "@phoenix/pages/project/AnnotationSummary";
import type { EvaluatorScoreWindow } from "@phoenix/pages/project/evaluators/projectEvaluatorScoreWindow";
import type { ProjectEvaluatorResultAnnotation } from "@phoenix/pages/project/evaluators/useProjectEvaluatorResultAnnotations";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

/**
 * One annotation's score aggregates as the row fragment selects them from
 * `ProjectEvaluator.annotationScoreMetrics`.
 */
export type EvaluatorAnnotationScoreMetricsData = {
  readonly annotationName: string;
  readonly summary: {
    readonly meanScore: number | null | undefined;
    readonly count: number;
    readonly scoreCount: number;
    readonly labelCount: number;
    readonly labelFractions: ReadonlyArray<{
      readonly label: string;
      readonly fraction: number;
    }>;
  } | null;
  readonly previousSummary: {
    readonly meanScore: number | null | undefined;
  } | null;
  readonly series: ReadonlyArray<{
    readonly timestamp: string;
    readonly meanScore: number | null | undefined;
  }>;
};

const meanScoreAlignmentCSS = css`
  /* AnnotationScoreText insets a directed score as a padded pill; mirror
     that inset for undirected and fallback scores so the values start at
     the same x position on every row of the column. */
  > .text:not(:has([data-direction])) {
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

const EvaluatorScoreWindowContext = createContext<EvaluatorScoreWindow | null>(
  null
);

/**
 * Provides the score window to the mean score column's header and cells.
 *
 * Context rather than a prop threaded through the column defs: a column def
 * closing over the window would rebuild — and, because tanstack renders the
 * def's `cell` function as an element type, REMOUNT every cell — each time
 * the window changes, including the live range's once-a-minute/hour
 * re-anchor. A context update just re-renders.
 */
export const EvaluatorScoreWindowProvider =
  EvaluatorScoreWindowContext.Provider;

function useEvaluatorScoreWindow(): EvaluatorScoreWindow {
  const scoreWindow = useContext(EvaluatorScoreWindowContext);
  invariant(
    scoreWindow != null,
    "useEvaluatorScoreWindow requires an EvaluatorScoreWindowProvider"
  );
  return scoreWindow;
}

/** The mean score column's header: the label plus the window it covers. */
export function ProjectEvaluatorMeanScoreHeader() {
  const scoreWindow = useEvaluatorScoreWindow();
  return (
    <Flex direction="row" gap="size-50" alignItems="baseline">
      <span title="Mean score of the annotations this evaluator produced in the selected time range (at most the last 30 days), with the change vs. the previous window.">
        mean score
      </span>
      <Text size="XS" fontFamily="mono" color="text-500">
        {scoreWindow.windowKey}
      </Text>
    </Flex>
  );
}

/**
 * The evaluators table's mean score cell: for each annotation the evaluator
 * writes, the mean score over the (clamped) page time range, its change vs.
 * the previous window, and a sparkline of per-bin means. The data arrives
 * with the row via `ProjectEvaluator.annotationScoreMetrics`, which the
 * connection only fetches while the column is visible.
 */
export function ProjectEvaluatorMeanScoreCell({
  annotations,
  scoreMetrics,
}: {
  /** The annotations the evaluator writes, named the way its runs persist them. */
  annotations: ReadonlyArray<ProjectEvaluatorResultAnnotation>;
  /** The row's score aggregates; undefined while not fetched. */
  scoreMetrics:
    | ReadonlyArray<EvaluatorAnnotationScoreMetricsData>
    | null
    | undefined;
}) {
  const scoreWindow = useEvaluatorScoreWindow();
  return (
    <Flex direction="column" gap="size-50">
      {annotations.map((annotation) => (
        <AnnotationMeanScoreView
          key={annotation.name}
          annotation={annotation}
          scoreWindow={scoreWindow}
          metrics={scoreMetrics?.find(
            (entry) => entry.annotationName === annotation.name
          )}
        />
      ))}
    </Flex>
  );
}

function AnnotationMeanScoreView({
  annotation,
  scoreWindow,
  metrics,
}: {
  annotation: ProjectEvaluatorResultAnnotation;
  scoreWindow: EvaluatorScoreWindow;
  metrics: EvaluatorAnnotationScoreMetricsData | undefined;
}) {
  const { windowKey } = scoreWindow;
  const binTimeFormatter = useBinTimeTickFormatter({
    scale: scoreWindow.timeBinConfig.scale,
  });
  const summary = metrics?.summary;
  const previousMeanScore = metrics?.previousSummary?.meanScore;
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
  // Plain 2-decimal magnitude: formatFloat's scientific notation for tiny
  // values reads as noise on a difference (e.g. "▲ 8.13e-3").
  const deltaText =
    delta == null
      ? null
      : `${delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} ${Math.abs(delta).toFixed(2)}`;
  const series = metrics?.series ?? [];
  const sparkValues = series.map((bin) =>
    typeof bin.meanScore === "number" ? bin.meanScore : null
  );
  return (
    <Flex direction="row" alignItems="center" gap="size-100" minWidth={0}>
      {/* The score and delta carry the summary breakdown; the sparkline sits
          outside the trigger so its hover shows per-point detail instead. */}
      <TooltipTrigger delay={0}>
        <TriggerWrap>
          <Flex direction="row" alignItems="center" gap="size-100" flex="none">
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
      <Sparkline
        values={sparkValues}
        aria-label={`Mean ${annotation.name} score over the last ${windowKey}`}
        renderPointDetail={(index) => {
          const timestamp = series[index]?.timestamp;
          const value = sparkValues[index];
          if (timestamp == null || value == null) {
            return null;
          }
          return (
            <Text size="S">
              {binTimeFormatter(new Date(timestamp))} · μ {formatFloat(value)}
            </Text>
          );
        }}
        color={
          isImprovement == null
            ? "var(--global-color-gray-500)"
            : isImprovement
              ? "var(--global-color-success)"
              : "var(--global-color-danger)"
        }
      />
    </Flex>
  );
}
