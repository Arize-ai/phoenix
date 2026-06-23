import type { z } from "zod";

import type {
  ApprovalApplyResult,
  ApprovalSource,
  PendingApproval,
} from "@phoenix/agent/shared/pendingApproval";

import type {
  createAnnotationConfigInputSchema,
  updateAnnotationConfigInputSchema,
} from "./schemas";

export type { ApprovalSource } from "@phoenix/agent/shared/pendingApproval";

export type CreateAnnotationConfigInput = z.infer<
  typeof createAnnotationConfigInputSchema
>;

export type UpdateAnnotationConfigInput = z.infer<
  typeof updateAnnotationConfigInputSchema
>;

/** The config fields shared by create and update, rendered in the approval card. */
export type AnnotationConfigDraft = {
  type: "categorical" | "continuous" | "freeform";
  name: string;
  description?: string | null;
  optimizationDirection?: "MINIMIZE" | "MAXIMIZE" | "NONE";
  values?: { label: string; score?: number | null }[];
  lowerBound?: number | null;
  upperBound?: number | null;
  threshold?: number | null;
};

/** What a pending annotation-config write will do, rendered in the approval card. */
export type AnnotationConfigWritePreview =
  | { kind: "create"; draft: AnnotationConfigDraft; projectId?: string | null }
  | { kind: "update"; configId: string; draft: AnnotationConfigDraft };

/** Outcome of applying an annotation-config write (the generic apply result). */
export type AnnotationConfigWriteApplyResult = ApprovalApplyResult;

/**
 * An annotation-config write (create + optional project association, or full
 * replace) proposed by a tool call and awaiting the user's Create/Update/Reject
 * in manual edit mode. `acceptDraft` lets the PXI approval card submit a
 * user-edited draft instead of blindly applying the model's original proposal.
 */
export type PendingAnnotationConfigWrite =
  PendingApproval<AnnotationConfigWritePreview> & {
    acceptDraft?: (
      draft: AnnotationConfigDraft,
      options?: { approvalSource?: ApprovalSource }
    ) => Promise<void>;
  };
