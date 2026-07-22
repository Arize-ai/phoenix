import type { AnnotationConfigInput } from "./__generated__/createAnnotationConfigToolMutation.graphql";
import type {
  AnnotationConfigDraft,
  CreateAnnotationConfigInput,
  UpdateAnnotationConfigInput,
} from "./types";

/** Project the shared config fields out of a create/update tool input. */
export function toAnnotationConfigDraft(
  input: CreateAnnotationConfigInput | UpdateAnnotationConfigInput
): AnnotationConfigDraft {
  return {
    type: input.type,
    name: input.name,
    description: input.description,
    optimizationDirection: input.optimizationDirection,
    values: input.values,
    lowerBound: input.lowerBound,
    upperBound: input.upperBound,
    threshold: input.threshold,
  };
}

/**
 * Map the flat, `type`-discriminated draft onto the GraphQL `AnnotationConfigInput`
 * one-of (exactly one of categorical / continuous / freeform set). The server input
 * types require `optimizationDirection`, so default it to `NONE` when the model
 * omits it.
 */
export function buildAnnotationConfigInput(
  draft: AnnotationConfigDraft
): AnnotationConfigInput {
  const optimizationDirection = draft.optimizationDirection ?? "NONE";
  const description = draft.description ?? null;
  switch (draft.type) {
    case "categorical":
      return {
        categorical: {
          name: draft.name,
          description,
          optimizationDirection,
          values: (draft.values ?? []).map((value) => ({
            label: value.label,
            score: value.score ?? null,
          })),
        },
      };
    case "continuous":
      return {
        continuous: {
          name: draft.name,
          description,
          optimizationDirection,
          lowerBound: draft.lowerBound ?? null,
          upperBound: draft.upperBound ?? null,
        },
      };
    case "freeform":
      return {
        freeform: {
          name: draft.name,
          description,
          optimizationDirection,
          threshold: draft.threshold ?? null,
          lowerBound: draft.lowerBound ?? null,
          upperBound: draft.upperBound ?? null,
        },
      };
  }
}
