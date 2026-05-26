import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";

import type { OutputConfigDraft } from "./types";

/**
 * Convert the form's `AnnotationConfig` to a wire-stable `OutputConfigDraft`.
 *
 * Detection happens at the form-snapshot conversion boundary only:
 * - `values` array present → classification
 * - else `threshold` field present → freeform
 * - else continuous
 *
 * Downstream consumers (tool JSON schemas, revision hash, diff serializer,
 * mutation conversion) read the explicit `kind` discriminator.
 */
export function toOutputConfigDraft(config: AnnotationConfig): OutputConfigDraft {
  if ("values" in config) {
    return {
      kind: "classification",
      name: config.name,
      optimizationDirection: config.optimizationDirection,
      values: config.values.map((value) => ({
        label: value.label,
        score: value.score ?? null,
      })),
    };
  }
  if ("threshold" in config) {
    return {
      kind: "freeform",
      name: config.name,
      optimizationDirection: config.optimizationDirection,
      threshold: config.threshold ?? null,
      lowerBound: config.lowerBound ?? null,
      upperBound: config.upperBound ?? null,
    };
  }
  return {
    kind: "continuous",
    name: config.name,
    optimizationDirection: config.optimizationDirection,
    lowerBound: config.lowerBound ?? null,
    upperBound: config.upperBound ?? null,
  };
}

export function toOutputConfigDrafts(
  configs: AnnotationConfig[]
): OutputConfigDraft[] {
  return configs.map(toOutputConfigDraft);
}

/** Inverse of `toOutputConfigDraft`, used by the create commit handler. */
export function fromOutputConfigDraft(
  draft: OutputConfigDraft
): AnnotationConfig {
  switch (draft.kind) {
    case "classification":
      return {
        name: draft.name,
        optimizationDirection: draft.optimizationDirection,
        values: draft.values.map((value) => ({
          label: value.label,
          score: value.score ?? undefined,
        })),
      };
    case "continuous":
      return {
        name: draft.name,
        optimizationDirection: draft.optimizationDirection,
        lowerBound: draft.lowerBound ?? null,
        upperBound: draft.upperBound ?? null,
      };
    case "freeform":
      return {
        name: draft.name,
        optimizationDirection: draft.optimizationDirection,
        threshold: draft.threshold ?? null,
        lowerBound: draft.lowerBound ?? null,
        upperBound: draft.upperBound ?? null,
      };
  }
}
