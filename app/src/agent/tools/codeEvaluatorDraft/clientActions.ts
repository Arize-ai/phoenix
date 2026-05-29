import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import {
  parseEditCodeEvaluatorDraftActionContext,
  parseEditCodeEvaluatorDraftInput,
  parseReadCodeEvaluatorDraftInput,
  parseTestCodeEvaluatorDraftInput,
} from "./parsers";
import { bindPendingCodeEvaluatorEditActions } from "./pendingCodeEvaluatorEdit";
import type {
  CodeEvaluatorActionResult,
  CodeEvaluatorDraftHost,
  PendingCodeEvaluatorEdit,
} from "./types";

/**
 * Returns the current draft snapshot as a JSON string for `read_code_evaluator_draft`.
 */
export function createReadCodeEvaluatorDraftClientAction({
  getDraftHost,
}: {
  getDraftHost: () => CodeEvaluatorDraftHost | null;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseReadCodeEvaluatorDraftInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid read_code_evaluator_draft input.",
      };
    }
    const host = getDraftHost();
    if (!host) {
      return {
        ok: false,
        error: "The code-evaluator form is not mounted; cannot read the draft.",
      };
    }
    return { ok: true, output: JSON.stringify(host.getSnapshot(), null, 2) };
  };
}

/**
 * Previews the proposed edit and registers a pending edit for accept/reject.
 */
export function createEditCodeEvaluatorDraftClientAction({
  getDraftHost,
  setPendingCodeEvaluatorEdit,
  shouldAutoAccept = () => false,
}: {
  getDraftHost: () => CodeEvaluatorDraftHost | null;
  setPendingCodeEvaluatorEdit: (
    toolCallId: string,
    edit: PendingCodeEvaluatorEdit | null
  ) => void;
  shouldAutoAccept?: () => boolean;
}) {
  return async (
    input: unknown,
    context?: unknown
  ): Promise<AgentClientActionResult> => {
    const editContext = parseEditCodeEvaluatorDraftActionContext(context);
    if (!editContext) {
      return {
        ok: false,
        error:
          "Cannot propose code-evaluator draft edit without tool call context.",
      };
    }
    const parsed = parseEditCodeEvaluatorDraftInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid edit_code_evaluator_draft input.",
      };
    }
    const host = getDraftHost();
    if (!host) {
      return {
        ok: false,
        error: "The code-evaluator form is not mounted; cannot edit the draft.",
      };
    }
    const before = host.getSnapshot();
    const proposed = host.previewOperations(before, parsed.operations);
    if (!proposed.ok) return proposed;

    const pendingEdit = bindPendingCodeEvaluatorEditActions({
      pendingEdit: {
        toolCallId: editContext.toolCallId,
        sessionId: editContext.sessionId,
        before,
        after: proposed.output,
        operations: parsed.operations,
      },
      draftHost: host,
      addToolOutput: editContext.addToolOutput,
      setPendingCodeEvaluatorEdit,
    });

    // Auto-mode ("bypass" edit permission): apply immediately without surfacing
    // the accept/reject confirmation dialog.
    if (shouldAutoAccept()) {
      await pendingEdit.accept?.({ approvalSource: "auto" });
      return { ok: true };
    }

    setPendingCodeEvaluatorEdit(editContext.toolCallId, pendingEdit);
    return { ok: true };
  };
}

/**
 * Runs the mounted draft against its test payload for `test_code_evaluator_draft`,
 * returning the preview result as a JSON string.
 */
export function createTestCodeEvaluatorDraftClientAction({
  isDraftMounted,
  runEvaluatorPreview,
}: {
  isDraftMounted: () => boolean;
  runEvaluatorPreview: () => Promise<CodeEvaluatorActionResult<unknown>>;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseTestCodeEvaluatorDraftInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid test_code_evaluator_draft input.",
      };
    }
    if (!isDraftMounted()) {
      return {
        ok: false,
        error: "The code-evaluator form is not mounted; cannot test the draft.",
      };
    }
    const result = await runEvaluatorPreview();
    if (!result.ok) {
      return result;
    }
    return { ok: true, output: JSON.stringify(result.output, null, 2) };
  };
}
