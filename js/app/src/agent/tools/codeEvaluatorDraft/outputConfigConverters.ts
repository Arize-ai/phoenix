import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import { assertUnreachable } from "@phoenix/typeUtils";
import { getEvaluatorOutputConfigType } from "@phoenix/utils/evaluatorOutputConfigUtils";

import type { OutputConfigDraft } from "./types";

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
  if (getEvaluatorOutputConfigType(config) === "FREEFORM") {
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
    threshold: config.threshold ?? null,
  };
}

export function toOutputConfigDrafts(
  configs: AnnotationConfig[]
): OutputConfigDraft[] {
  return configs.map(toOutputConfigDraft);
}

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
        annotationType: "CONTINUOUS",
        name: draft.name,
        optimizationDirection: draft.optimizationDirection,
        lowerBound: draft.lowerBound ?? null,
        upperBound: draft.upperBound ?? null,
        threshold: draft.threshold ?? null,
      };
    case "freeform":
      return {
        annotationType: "FREEFORM",
        name: draft.name,
        optimizationDirection: draft.optimizationDirection,
        threshold: draft.threshold ?? null,
        lowerBound: draft.lowerBound ?? null,
        upperBound: draft.upperBound ?? null,
      };
    default:
      return assertUnreachable(draft);
  }
}
