import type { z } from "zod";

import type { ApprovalSource } from "@phoenix/agent/tools/approval";

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
  /** Agent session that owns the unresolved batch_span_annotate tool call. */
  sessionId: string;
  /** The one or more annotations proposed by this tool call. */
  annotations: AnnotateSpanInput[];
  accept?: (options?: { approvalSource?: ApprovalSource }) => Promise<void>;
  reject?: () => Promise<void>;
  cancel?: () => Promise<void>;
};

export type BindPendingBatchSpanAnnotateOptions = {
  pendingAnnotation: PendingBatchSpanAnnotate;
  applyAnnotations: (annotations: AnnotateSpanInput[]) => Promise<void>;
  addToolOutput: BatchSpanAnnotateToolOutputSender;
  setPendingBatchSpanAnnotate: (
    toolCallId: string,
    annotation: PendingBatchSpanAnnotate | null
  ) => void;
};
