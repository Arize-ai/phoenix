import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import { assertUnreachable } from "@phoenix/typeUtils";

import type { OutputConfigDraft } from "./types";

function toOutputConfigDraft(config: AnnotationConfig): OutputConfigDraft {
  const descriptionField =
    config.description !== undefined ? { description: config.description } : {};
  if ("values" in config) {
    return {
      kind: "classification",
      name: config.name,
      ...descriptionField,
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
      ...descriptionField,
      optimizationDirection: config.optimizationDirection,
      threshold: config.threshold ?? null,
      lowerBound: config.lowerBound ?? null,
      upperBound: config.upperBound ?? null,
    };
  }
  return {
    kind: "continuous",
    name: config.name,
    ...descriptionField,
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

export function fromOutputConfigDraft(
  draft: OutputConfigDraft
): AnnotationConfig {
  const descriptionField =
    draft.description !== undefined ? { description: draft.description } : {};
  switch (draft.kind) {
    case "classification":
      return {
        name: draft.name,
        ...descriptionField,
        optimizationDirection: draft.optimizationDirection,
        values: draft.values.map((value) => ({
          label: value.label,
          score: value.score ?? undefined,
        })),
      };
    case "continuous":
      return {
        name: draft.name,
        ...descriptionField,
        optimizationDirection: draft.optimizationDirection,
        lowerBound: draft.lowerBound ?? null,
        upperBound: draft.upperBound ?? null,
      };
    case "freeform":
      return {
        name: draft.name,
        ...descriptionField,
        optimizationDirection: draft.optimizationDirection,
        threshold: draft.threshold ?? null,
        lowerBound: draft.lowerBound ?? null,
        upperBound: draft.upperBound ?? null,
      };
    default:
      return assertUnreachable(draft);
  }
}
