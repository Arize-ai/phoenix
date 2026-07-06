import { bindPendingApproval } from "@phoenix/agent/shared/pendingApproval";

import type {
  AnnotateSpanInput,
  BindPendingBatchSpanAnnotateOptions,
  PendingBatchSpanAnnotate,
} from "./types";

export const BATCH_SPAN_ANNOTATE_NAVIGATION_CANCEL_ERROR =
  "The span annotation proposal was cancelled because the annotation editor was unmounted.";

/** Serializable per-annotation summary persisted onto the resolved output. */
function toAnnotationOutput(annotation: AnnotateSpanInput) {
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
 * Attaches accept/reject/cancel callbacks to a pending batch span annotate
 * proposal. The generic lifecycle lives in {@link bindPendingApproval}; only the
 * commit (applying the annotations) is annotation-specific.
 */
export function bindPendingBatchSpanAnnotateActions({
  pendingAnnotation,
  applyAnnotations,
  addToolOutput,
  clearPending,
}: BindPendingBatchSpanAnnotateOptions): PendingBatchSpanAnnotate {
  const { annotations } = pendingAnnotation;
  const count = annotations.length;
  const noun = count === 1 ? "annotation" : "annotations";
  return bindPendingApproval<PendingBatchSpanAnnotate>({
    pending: pendingAnnotation,
    addToolOutput,
    clearPending,
    navigationCancelError: BATCH_SPAN_ANNOTATE_NAVIGATION_CANCEL_ERROR,
    commit: async ({ approvalSource }) => {
      try {
        await applyAnnotations(annotations);
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to apply span annotations.",
        };
      }
      return {
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
      };
    },
    buildRejectedOutput: () => ({
      status: "rejected",
      count,
      annotations: annotations.map(toAnnotationOutput),
      message: `User rejected the proposed span ${noun}.`,
    }),
  });
}
