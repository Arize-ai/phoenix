import type {
  AnnotationConfigActionResult,
  AnnotationConfigDraftSnapshot,
  EditAnnotationConfigDraftOperation,
} from "./types";

/**
 * Pure reducer that applies edit operations to an annotation-config draft
 * snapshot. Mirrors the code-evaluator draft reducer: it never mutates the
 * form directly — callers preview or commit the returned snapshot. Honors the
 * edit-mode lock on `annotationType` (immutable once a config exists).
 */
export function applyDraftOperations({
  snapshot,
  operations,
}: {
  snapshot: AnnotationConfigDraftSnapshot;
  operations: EditAnnotationConfigDraftOperation[];
}): AnnotationConfigActionResult<AnnotationConfigDraftSnapshot> {
  let next: AnnotationConfigDraftSnapshot = { ...snapshot };
  for (const operation of operations) {
    switch (operation.type) {
      case "set_name": {
        next = { ...next, name: operation.name };
        break;
      }
      case "set_description": {
        next = { ...next, description: operation.description };
        break;
      }
      case "set_annotation_type": {
        if (next.mode === "edit") {
          return {
            ok: false,
            error:
              "Annotation type is immutable on an existing annotation config; remove the `set_annotation_type` operation.",
          };
        }
        next = { ...next, annotationType: operation.annotationType };
        break;
      }
      case "set_optimization_direction": {
        next = {
          ...next,
          optimizationDirection: operation.optimizationDirection,
        };
        break;
      }
      case "set_lower_bound": {
        next = { ...next, lowerBound: operation.lowerBound };
        break;
      }
      case "set_upper_bound": {
        next = { ...next, upperBound: operation.upperBound };
        break;
      }
      case "set_values": {
        next = {
          ...next,
          values: operation.values.map((value) => ({
            label: value.label,
            score: value.score ?? null,
          })),
        };
        break;
      }
    }
  }
  return { ok: true, output: next };
}
