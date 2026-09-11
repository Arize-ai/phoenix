import type {
  AnnotateSpanInput,
  BindPendingBatchSpanAnnotateOperationOptions,
  PendingBatchSpanAnnotate,
} from "./types";

export const BATCH_SPAN_ANNOTATE_NAVIGATION_CANCEL_ERROR =
  "The span annotation proposal was cancelled because the annotation editor was unmounted.";

/** Serializable per-annotation summary persisted onto the resolved output. */
export function toAnnotationOutput(annotation: AnnotateSpanInput) {
  return {
    spanId: annotation.spanId ?? null,
    spanNodeId: annotation.spanNodeId ?? null,
    name: annotation.name,
    label: annotation.label ?? null,
    score: annotation.score ?? null,
    explanation: annotation.explanation ?? null,
  };
}

/**
 * Attach callbacks that resolve the calling `execute_browser_action` script.
 * Apply failures resolve `{ ok: false }`; rejection resolves
 * `{ ok: true, output: { status: "rejected", … } }`.
 */
export function bindPendingBatchSpanAnnotateOperationActions({
  pendingAnnotation,
  applyAnnotations,
  emitResult,
  setPendingBatchSpanAnnotate,
}: BindPendingBatchSpanAnnotateOperationOptions): PendingBatchSpanAnnotate {
  const { annotations } = pendingAnnotation;
  const count = annotations.length;
  const noun = count === 1 ? "annotation" : "annotations";
  return {
    ...pendingAnnotation,
    accept: async ({ approvalSource = "user" } = {}) => {
      setPendingBatchSpanAnnotate(pendingAnnotation.toolCallId, null);
      try {
        await applyAnnotations(annotations);
      } catch (error) {
        emitResult({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to apply span annotations.",
        });
        return;
      }
      emitResult({
        ok: true,
        output: {
          status: "accepted",
          acceptedBy: approvalSource,
          count,
          annotations: annotations.map(toAnnotationOutput),
          message:
            approvalSource === "auto"
              ? `${count} span ${noun} auto-approved.`
              : `${count} span ${noun} applied.`,
        },
      });
    },
    reject: async () => {
      setPendingBatchSpanAnnotate(pendingAnnotation.toolCallId, null);
      emitResult({
        ok: true,
        output: {
          status: "rejected",
          count,
          annotations: annotations.map(toAnnotationOutput),
          message: `User rejected the proposed span ${noun}.`,
        },
      });
    },
    cancel: async () => {
      setPendingBatchSpanAnnotate(pendingAnnotation.toolCallId, null);
      emitResult({
        ok: false,
        error: BATCH_SPAN_ANNOTATE_NAVIGATION_CANCEL_ERROR,
      });
    },
  };
}
