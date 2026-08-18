import type { z } from "zod";

import type {
  ApprovalApplyResult,
  PendingApproval,
} from "@phoenix/agent/shared/pendingApproval";

import type { annotateInputSchema } from "./schemas";

export type { ApprovalSource } from "@phoenix/agent/shared/pendingApproval";

/** Parsed input for `annotate`: one annotation on a span, trace, or session. */
export type AnnotateInput = z.output<typeof annotateInputSchema>;

export type AnnotatePreview = AnnotateInput;

export type AnnotateApplyResult = ApprovalApplyResult;

export type PendingAnnotate = PendingApproval<AnnotatePreview>;
