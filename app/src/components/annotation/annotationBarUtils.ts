import type { Annotation } from "@phoenix/components/annotation/types";
import type { AnnotationConfig } from "@phoenix/pages/settings/types";
import { assertUnreachable } from "@phoenix/typeUtils";

export type AnnotationAggregate = {
  label: string | null;
  score: number | null;
  isMixed: boolean;
};

/**
 * Builds the compact value shown on an annotation label.
 * @param params - aggregate inputs
 * @param params.annotations - annotations sharing one configuration name
 */
export function getAnnotationAggregate({
  annotations,
}: {
  annotations: readonly Annotation[];
}): AnnotationAggregate {
  const scores = annotations
    .map((annotation) => annotation.score)
    .filter((score): score is number => typeof score === "number");
  const labels = annotations
    .map((annotation) => annotation.label)
    .filter((label): label is string => Boolean(label));
  const score =
    scores.length > 0
      ? scores.reduce((total, nextScore) => total + nextScore, 0) /
        scores.length
      : null;

  if (annotations.length === 1) {
    return {
      score,
      label: labels[0] ?? null,
      isMixed: false,
    };
  }

  const hasScores = scores.length > 0;
  const hasLabels = labels.length > 0;
  return {
    score,
    label: hasScores && hasLabels ? "mixed" : labels.join(", ") || null,
    isMixed: hasScores && hasLabels,
  };
}

/**
 * Groups non-note annotations by configuration name.
 * @param params - grouping inputs
 * @param params.annotations - annotations to group
 */
export function groupAnnotationsByName({
  annotations,
}: {
  annotations: readonly Annotation[];
}): Partial<Record<string, Annotation[]>> {
  const annotationsByName: Partial<Record<string, Annotation[]>> = {};
  for (const annotation of annotations) {
    if (annotation.name === "note") {
      continue;
    }
    annotationsByName[annotation.name] = [
      ...(annotationsByName[annotation.name] ?? []),
      annotation,
    ];
  }
  return annotationsByName;
}

export type AnnotationConfigDraft = {
  annotationType: AnnotationConfig["annotationType"];
  description: string;
  id: string;
  lowerBound: string;
  name: string;
  optimizationDirection: "MAXIMIZE" | "MINIMIZE" | "NONE";
  upperBound: string;
  values: { label: string; score: string }[];
};

/**
 * Converts a saved annotation config into serializable form state.
 * @param params - draft inputs
 * @param params.config - source config
 */
export function getAnnotationConfigDraft({
  config,
}: {
  config: AnnotationConfig;
}): AnnotationConfigDraft {
  return {
    annotationType: config.annotationType,
    description: config.description ?? "",
    id: config.id ?? "",
    lowerBound:
      "lowerBound" in config && typeof config.lowerBound === "number"
        ? String(config.lowerBound)
        : "0",
    name: config.name,
    optimizationDirection: config.optimizationDirection ?? "NONE",
    upperBound:
      "upperBound" in config && typeof config.upperBound === "number"
        ? String(config.upperBound)
        : "1",
    values:
      config.annotationType === "CATEGORICAL"
        ? (config.values ?? []).map((value) => ({
            label: value.label,
            score: typeof value.score === "number" ? String(value.score) : "",
          }))
        : [
            { label: "positive", score: "1" },
            { label: "negative", score: "0" },
          ],
  };
}

/** Creates defaults for the quick-add annotation-config path. */
export function getNewAnnotationConfigDraft({
  name = "",
}: {
  name?: string;
} = {}): AnnotationConfigDraft {
  return {
    annotationType: "CATEGORICAL",
    description: "",
    id: "",
    lowerBound: "0",
    name,
    optimizationDirection: "MAXIMIZE",
    upperBound: "1",
    values: [
      { label: "positive", score: "1" },
      { label: "negative", score: "0" },
    ],
  };
}

/**
 * Converts annotation-config form state into the settings-domain union.
 * @param params - conversion inputs
 * @param params.draft - validated form draft
 */
export function getAnnotationConfigFromDraft({
  draft,
}: {
  draft: AnnotationConfigDraft;
}): AnnotationConfig {
  const shared = {
    id: draft.id,
    name: draft.name.trim(),
    description: draft.description.trim() || null,
  };
  switch (draft.annotationType) {
    case "CATEGORICAL":
      return {
        ...shared,
        annotationType: "CATEGORICAL",
        optimizationDirection: draft.optimizationDirection,
        values: draft.values.map((value) => ({
          label: value.label.trim(),
          score: value.score.trim() === "" ? null : Number(value.score),
        })),
      };
    case "CONTINUOUS":
      return {
        ...shared,
        annotationType: "CONTINUOUS",
        optimizationDirection: draft.optimizationDirection,
        lowerBound:
          draft.lowerBound.trim() === "" ? null : Number(draft.lowerBound),
        upperBound:
          draft.upperBound.trim() === "" ? null : Number(draft.upperBound),
      };
    case "FREEFORM":
      return {
        ...shared,
        annotationType: "FREEFORM",
        optimizationDirection: draft.optimizationDirection,
      };
  }
  return assertUnreachable(draft.annotationType);
}
