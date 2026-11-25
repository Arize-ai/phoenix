import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";
import { getOptimizationBounds } from "@phoenix/components/annotation/optimizationUtils";
import type {
  LabelDelta,
  MetricDelta,
} from "@phoenix/components/experiment/experimentDeltaUtils";
import {
  computeLabelDelta,
  computeMetricDelta,
  MISSING_VALUE_TEXT,
} from "@phoenix/components/experiment/experimentDeltaUtils";
import { calculateAnnotationScorePercentile } from "@phoenix/pages/experiment/utils";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";
import { clampNumber } from "@phoenix/utils/numberUtils";

const DEFAULT_MAX_VISIBLE_REPETITION_CELLS = 8;

const MIN_SCORE_CELL_OPACITY = 0.2;

export type CompareLaneAnnotationLike = {
  readonly name: string;
  readonly score: number | null;
  readonly label: string | null;
};

type CompareLaneAnnotatedRun<TAnnotation extends CompareLaneAnnotationLike> = {
  readonly repetitionNumber: number;
  readonly error: string | null;
  readonly annotations: readonly TAnnotation[];
};

/**
 * Whether an annotation's repetitions are compared as numbers or as labels.
 * `empty` means the lane has no value for the annotation in any repetition.
 */
export type AnnotationRowKind = "score" | "label" | "empty";

export type AnnotationRepetitionCell = {
  repetitionNumber: number;
  /** The repetition's value as text, `--` when it has none */
  valueText: string;
  /** Whether this is the repetition the lane shows */
  isShown: boolean;
  /** Score rows: how strongly the cell is filled, 0 when it has no score */
  fillOpacity: number;
  /** Label rows: whether the label equals the shown repetition's label */
  isMatchingShownLabel: boolean;
  hasValue: boolean;
};

export type LaneAnnotationRow<TAnnotation extends CompareLaneAnnotationLike> = {
  annotationName: string;
  kind: AnnotationRowKind;
  /** The shown repetition's annotation; null when it has none */
  annotation: TAnnotation | null;
  /** The shown repetition's value as text, `--` when it has none */
  valueText: string;
  /** The shown score's position between the experiment's min and max, 0–100 */
  scorePercent: number | null;
  /** One cell per repetition that ran, in repetition order */
  repetitionCells: AnnotationRepetitionCell[];
  /** The mean score, or the most common label, across repetitions */
  averageText: string;
};

/**
 * The annotation names a pair of lanes lists, in first-seen order: the base
 * lane's, then any only the compare lane has.
 */
export function getAnnotationNameUnion(
  annotationNameLists: readonly (readonly string[])[]
): string[] {
  return [...new Set(annotationNameLists.flat())];
}

/**
 * The most common label, the earliest one winning a tie. Null without labels.
 */
export function computeLabelMode(labels: readonly string[]): string | null {
  const countsByLabel = new Map<string, number>();
  for (const label of labels) {
    countsByLabel.set(label, (countsByLabel.get(label) ?? 0) + 1);
  }
  let mode: string | null = null;
  let modeCount = 0;
  for (const [label, count] of countsByLabel) {
    if (count > modeCount) {
      mode = label;
      modeCount = count;
    }
  }
  return mode;
}

/**
 * An annotation's value as a row shows it: its score, else its label, else
 * `--`.
 */
export function formatAnnotationValue(
  annotation: CompareLaneAnnotationLike | null
): string {
  if (annotation?.score != null) {
    return floatFormatter(annotation.score);
  }
  return annotation?.label || MISSING_VALUE_TEXT;
}

/**
 * One lane's row for an annotation: the shown repetition's value, a cell per
 * repetition, and the average across them.
 * @param params.annotationName - the annotation the row is for
 * @param params.runs - the lane's runs for the example
 * @param params.shownRepetitionNumber - the repetition the lane shows
 * @param params.minScore - the experiment's lowest score for the annotation
 * @param params.maxScore - the experiment's highest score for the annotation
 */
export function buildLaneAnnotationRow<
  TAnnotation extends CompareLaneAnnotationLike,
>({
  annotationName,
  runs,
  shownRepetitionNumber,
  minScore,
  maxScore,
}: {
  annotationName: string;
  runs: readonly CompareLaneAnnotatedRun<TAnnotation>[];
  shownRepetitionNumber: number;
  minScore?: number | null;
  maxScore?: number | null;
}): LaneAnnotationRow<TAnnotation> {
  const annotatedRuns = [...runs]
    .sort((runA, runB) => runA.repetitionNumber - runB.repetitionNumber)
    .map((run) => ({
      repetitionNumber: run.repetitionNumber,
      annotation:
        run.annotations.find(
          (annotation) => annotation.name === annotationName
        ) ?? null,
    }));
  const shownAnnotation =
    annotatedRuns.find((run) => run.repetitionNumber === shownRepetitionNumber)
      ?.annotation ?? null;
  const scores = annotatedRuns.flatMap((run) =>
    run.annotation?.score != null ? [run.annotation.score] : []
  );
  const labels = annotatedRuns.flatMap((run) =>
    run.annotation?.label ? [run.annotation.label] : []
  );
  const kind: AnnotationRowKind =
    scores.length > 0 ? "score" : labels.length > 0 ? "label" : "empty";

  const getScorePercent = (score: number) =>
    clampNumber({
      value: calculateAnnotationScorePercentile(score, minScore, maxScore),
      min: 0,
      max: 100,
    });

  const repetitionCells = annotatedRuns.map(
    ({ repetitionNumber, annotation }): AnnotationRepetitionCell => {
      const score = annotation?.score ?? null;
      const label = annotation?.label ?? null;
      return {
        repetitionNumber,
        valueText: formatAnnotationValue(annotation),
        isShown: repetitionNumber === shownRepetitionNumber,
        fillOpacity:
          kind === "score" && score != null
            ? MIN_SCORE_CELL_OPACITY +
              (1 - MIN_SCORE_CELL_OPACITY) * (getScorePercent(score) / 100)
            : 0,
        isMatchingShownLabel:
          kind === "label" &&
          label != null &&
          label === (shownAnnotation?.label ?? null),
        hasValue: kind === "score" ? score != null : label != null,
      };
    }
  );

  let averageText = MISSING_VALUE_TEXT;
  if (kind === "score") {
    averageText = floatFormatter(
      scores.reduce((sum, score) => sum + score, 0) / scores.length
    );
  } else if (kind === "label") {
    averageText = computeLabelMode(labels) ?? MISSING_VALUE_TEXT;
  }

  return {
    annotationName,
    kind,
    annotation: shownAnnotation,
    valueText: formatAnnotationValue(shownAnnotation),
    scorePercent:
      shownAnnotation?.score != null
        ? getScorePercent(shownAnnotation.score)
        : null,
    repetitionCells,
    averageText,
  };
}

export type AnnotationRowDelta =
  | { type: "score"; delta: MetricDelta }
  | { type: "label"; delta: LabelDelta };

/**
 * The compare lane's change against the base lane for one annotation, on the
 * repetitions the two lanes show. Scores compare as numbers and take their
 * good direction from the annotation config, so a change is neutral when the
 * config sets none. Annotations without a score on either side compare as
 * labels.
 * @param params.baseAnnotation - the base lane's shown annotation
 * @param params.compareAnnotation - the compare lane's shown annotation
 * @param params.config - the annotation's config, for its optimization direction
 */
export function computeAnnotationRowDelta({
  baseAnnotation,
  compareAnnotation,
  config,
}: {
  baseAnnotation: CompareLaneAnnotationLike | null;
  compareAnnotation: CompareLaneAnnotationLike | null;
  config: AnnotationOptimizationConfig | undefined;
}): AnnotationRowDelta {
  const hasScore =
    baseAnnotation?.score != null || compareAnnotation?.score != null;
  const hasLabel =
    baseAnnotation?.label != null || compareAnnotation?.label != null;
  if (!hasScore && hasLabel) {
    return {
      type: "label",
      delta: computeLabelDelta({
        baseLabel: baseAnnotation?.label,
        compareLabel: compareAnnotation?.label,
        config,
      }),
    };
  }
  return {
    type: "score",
    delta: computeMetricDelta({
      base: baseAnnotation?.score,
      compare: compareAnnotation?.score,
      optimizationDirection:
        getOptimizationBounds(config).optimizationDirection,
    }),
  };
}

/**
 * Splits a row's repetition cells into the ones drawn and a count of the
 * rest, which the row shows as `+N`.
 */
export function capRepetitionCells({
  cells,
  maxVisibleCount = DEFAULT_MAX_VISIBLE_REPETITION_CELLS,
}: {
  cells: readonly AnnotationRepetitionCell[];
  maxVisibleCount?: number;
}): { visibleCells: AnnotationRepetitionCell[]; hiddenCount: number } {
  return {
    visibleCells: cells.slice(0, maxVisibleCount),
    hiddenCount: Math.max(cells.length - maxVisibleCount, 0),
  };
}
