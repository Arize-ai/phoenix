import type { z } from "zod";

import type { PendingApprovalActions } from "@phoenix/agent/shared/pendingApproval";
import type { ApprovalSource } from "@phoenix/agent/tools/approval";

import { BATCH_SPAN_ANNOTATE_TOOL_NAME } from "./constants";
import type {
  annotateSpanInputSchema,
  batchSpanAnnotateActionContextSchema,
  BatchSpanAnnotateToolOutputSender,
  batchSpanAnnotateInputSchema,
} from "./schemas";

export type { ApprovalSource };

/** A single span annotation entry within a batch. */
export type AnnotateSpanInput = z.output<typeof annotateSpanInputSchema>;

/** Parsed input for `batch_span_annotate`: one or more annotations. */
export type BatchSpanAnnotateInput = z.output<
  typeof batchSpanAnnotateInputSchema
>;

export type BatchSpanAnnotateActionContext = z.output<
  typeof batchSpanAnnotateActionContextSchema
>;

export type PendingBatchSpanAnnotate = {
  toolCallId: string;
  toolName: typeof BATCH_SPAN_ANNOTATE_TOOL_NAME;
  /** Agent session that owns the unresolved batch_span_annotate tool call. */
  sessionId: string;
  /** The one or more annotations proposed by this tool call. */
  annotations: AnnotateSpanInput[];
} & PendingApprovalActions;

export type BindPendingBatchSpanAnnotateOptions = {
  pendingAnnotation: Omit<
    PendingBatchSpanAnnotate,
    keyof PendingApprovalActions
  >;
  applyAnnotations: (annotations: AnnotateSpanInput[]) => Promise<void>;
  addToolOutput: BatchSpanAnnotateToolOutputSender;
  /** Clears this proposal from the unified pending-approval store slice. */
  clearPending: (toolCallId: string) => void;
};
