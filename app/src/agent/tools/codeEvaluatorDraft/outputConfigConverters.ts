// Adapter between the two faces of `CodeEvaluator.output_configs`: the form's
// canonical `AnnotationConfig` and the wire `OutputConfigDraft`, which adds an
// explicit `kind` the downstream tool/diff/mutation paths read.
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";

import type { OutputConfigDraft } from "./types";

/**
 * Convert the form's `AnnotationConfig` to a wire-stable `OutputConfigDraft`,
 * the single place the `kind` discriminant is assigned.
 *
 * The variant detection must stay a runtime structural check: the canonical
 * `AnnotationConfig` union carries no discriminator and `continuous` is a
 * structural near-supertype of the others, so neither `assertNever` nor a
 * type-level guard catches a new member — a new variant would fall through to
 * `continuous` until the canonical type gains its own discriminator.
 */
function toOutputConfigDraft(config: AnnotationConfig): OutputConfigDraft {
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

/** Inverse of `toOutputConfigDraft`. */
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
