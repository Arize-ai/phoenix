import type {
  AnnotationConfigDraft,
  PendingAnnotationConfigWrite,
} from "@phoenix/agent/tools/annotationConfig";

import { ApprovalCard } from "./ApprovalCard";

/**
 * Reduce a config draft to the fields relevant to its type, dropping empties so
 * the reviewed JSON shows only what the write actually sets.
 */
function describeDraft(draft: AnnotationConfigDraft): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type: draft.type,
    name: draft.name,
    optimizationDirection: draft.optimizationDirection ?? "NONE",
  };
  if (draft.description != null) {
    base.description = draft.description;
  }
  if (draft.type === "categorical") {
    base.values = draft.values ?? [];
  }
  if (draft.type === "continuous" || draft.type === "freeform") {
    if (draft.lowerBound != null) base.lowerBound = draft.lowerBound;
    if (draft.upperBound != null) base.upperBound = draft.upperBound;
  }
  if (draft.type === "freeform" && draft.threshold != null) {
    base.threshold = draft.threshold;
  }
  return base;
}

/**
 * Inline Accept/Reject card for an annotation-config write awaiting approval in
 * manual edit mode. Mirrors {@link DatasetWriteApprovalCard} for the
 * annotation-config domain (create + optional project association, or full replace).
 */
export function AnnotationConfigWriteApprovalCard({
  pending,
}: {
  pending: PendingAnnotationConfigWrite;
}) {
  const { preview } = pending;
  const label =
    preview.kind === "create"
      ? "Create annotation config"
      : "Replace annotation config";
  const payload =
    preview.kind === "create"
      ? {
          config: describeDraft(preview.draft),
          ...(preview.projectId ? { projectId: preview.projectId } : {}),
        }
      : { configId: preview.configId, config: describeDraft(preview.draft) };
  const note =
    preview.kind === "update"
      ? "Replaces the entire config. Any existing label not included here is removed."
      : null;
  return (
    <ApprovalCard
      preview={{ title: label, danger: note, body: { kind: "json", payload } }}
      onAccept={() => void pending.accept?.()}
      onReject={() => void pending.reject?.()}
      isDisabled={!(pending.accept && pending.reject)}
      staleMessage="This proposal was made in an earlier session and can't be applied here. Re-run your request to have the assistant propose it again."
    />
  );
}
