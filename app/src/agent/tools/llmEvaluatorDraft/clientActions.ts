import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import {
  parseEditLlmEvaluatorDraftActionContext,
  parseEditLlmEvaluatorDraftInput,
  parseReadLlmEvaluatorDraftInput,
  parseTestLlmEvaluatorDraftInput,
} from "./parsers";
import { bindPendingLlmEvaluatorEditActions } from "./pendingLlmEvaluatorEdit";
import type {
  LlmEvaluatorActionResult,
  LlmEvaluatorDraftHost,
  PendingLlmEvaluatorEdit,
} from "./types";

export function createReadLlmEvaluatorDraftClientAction({
  getDraftHost,
}: {
  getDraftHost: () => LlmEvaluatorDraftHost | null;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseReadLlmEvaluatorDraftInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid read_llm_evaluator_draft input.",
      };
    }
    const host = getDraftHost();
    if (!host) {
      return {
        ok: false,
        error: "The LLM-evaluator form is not mounted; cannot read the draft.",
      };
    }
    return { ok: true, output: JSON.stringify(host.getSnapshot(), null, 2) };
  };
}

export function createEditLlmEvaluatorDraftClientAction({
  getDraftHost,
  setPendingLlmEvaluatorEdit,
  shouldAutoAccept = () => false,
}: {
  getDraftHost: () => LlmEvaluatorDraftHost | null;
  setPendingLlmEvaluatorEdit: (
    toolCallId: string,
    edit: PendingLlmEvaluatorEdit | null
  ) => void;
  shouldAutoAccept?: () => boolean;
}) {
  return async (
    input: unknown,
    context?: unknown
  ): Promise<AgentClientActionResult> => {
    const editContext = parseEditLlmEvaluatorDraftActionContext(context);
    if (!editContext) {
      return {
        ok: false,
        error:
          "Cannot propose LLM-evaluator draft edit without tool call context.",
      };
    }
    const parsed = parseEditLlmEvaluatorDraftInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid edit_llm_evaluator_draft input.",
      };
    }
    const host = getDraftHost();
    if (!host) {
      return {
        ok: false,
        error: "The LLM-evaluator form is not mounted; cannot edit the draft.",
      };
    }
    const before = host.getSnapshot();
    const proposed = host.previewOperations(before, parsed.operations);
    if (!proposed.ok) return proposed;

    const pendingEdit = bindPendingLlmEvaluatorEditActions({
      pendingEdit: {
        toolCallId: editContext.toolCallId,
        sessionId: editContext.sessionId,
        before,
        after: proposed.output,
        operations: parsed.operations,
      },
      draftHost: host,
      addToolOutput: editContext.addToolOutput,
      setPendingLlmEvaluatorEdit,
    });

    if (shouldAutoAccept()) {
      await pendingEdit.accept?.({ approvalSource: "auto" });
      return { ok: true };
    }

    setPendingLlmEvaluatorEdit(editContext.toolCallId, pendingEdit);
    return { ok: true };
  };
}

export function createTestLlmEvaluatorDraftClientAction({
  isDraftMounted,
  runEvaluatorPreview,
}: {
  isDraftMounted: () => boolean;
  runEvaluatorPreview: () => Promise<LlmEvaluatorActionResult<unknown>>;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseTestLlmEvaluatorDraftInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid test_llm_evaluator_draft input.",
      };
    }
    if (!isDraftMounted()) {
      return {
        ok: false,
        error: "The LLM-evaluator form is not mounted; cannot test the draft.",
      };
    }
    const result = await runEvaluatorPreview();
    if (!result.ok) {
      return result;
    }
    return { ok: true, output: JSON.stringify(result.output, null, 2) };
  };
}
