import type { PendingBatchSpanAnnotate } from "@phoenix/agent/tools/batchSpanAnnotate";
import type { PendingCodeEvaluatorEdit } from "@phoenix/agent/tools/codeEvaluatorDraft";
import type { PendingLlmEvaluatorEdit } from "@phoenix/agent/tools/llmEvaluatorDraft";
import type { PendingLoadDataset } from "@phoenix/agent/tools/playgroundLoadDataset";
import type {
  PendingPromptEdit,
  PendingPromptInstanceRemoval,
} from "@phoenix/agent/tools/playgroundPrompt";
import type { PendingPromptToolWrite } from "@phoenix/agent/tools/playgroundPromptTools";
import type { PendingSavePrompt } from "@phoenix/agent/tools/playgroundSavePrompt";

/**
 * The single discriminated union of every approval-gated pending write,
 * discriminated by `toolName`. Each member carries its own preview data plus
 * the lifecycle callbacks bound by `bindPendingApproval` at dispatch/mount time.
 *
 * Adding a new approval tool means adding one member here and one arm to the
 * consuming ToolDetails switch — the store slice, setters, selector, and
 * navigation-cancel are all generic and need no per-tool change.
 */
export type PendingApproval =
  | PendingPromptEdit
  | PendingPromptInstanceRemoval
  | PendingBatchSpanAnnotate
  | PendingPromptToolWrite
  | PendingSavePrompt
  | PendingCodeEvaluatorEdit
  | PendingLlmEvaluatorEdit
  | PendingLoadDataset;

/** The store slice keying pending approvals by their originating tool-call id. */
export type PendingApprovalsByToolCallId = Partial<
  Record<string, PendingApproval>
>;
