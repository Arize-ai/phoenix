import { createEvaluatorSubmitClientAction } from "@phoenix/agent/tools/approval";
import { parseEmptyToolInput } from "@phoenix/agent/tools/emptyToolInput";
import { parseUiOperationCallContext } from "@phoenix/agent/uiOperations/types";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import { SUBMIT_LLM_EVALUATOR_DRAFT_TOOL_NAME } from "./constants";
import {
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
    const callContext = parseUiOperationCallContext(context);
    if (!callContext) {
      return {
        ok: false,
        error:
          "Cannot propose LLM-evaluator draft edit without an operation call context.",
      };
    }
    const parsed = parseEditLlmEvaluatorDraftInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid evaluators.llm.edit input.",
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

    // The returned promise resolves when the user (or bypass mode) decides;
    // the awaiting execute_ui script sits parked on it until then.
    return new Promise((resolve) => {
      const pendingEdit = bindPendingLlmEvaluatorEditActions({
        pendingEdit: {
          toolCallId: callContext.callId,
          sessionId: callContext.sessionId ?? "",
          before,
          after: proposed.output,
          operations: parsed.operations,
        },
        draftHost: host,
        emitResult: resolve,
        setPendingLlmEvaluatorEdit,
      });

      if (shouldAutoAccept()) {
        void pendingEdit.accept?.({ approvalSource: "auto" });
        return;
      }

      setPendingLlmEvaluatorEdit(callContext.callId, pendingEdit);
    });
  };
}

export function createSubmitLlmEvaluatorDraftClientAction({
  getDraftHost,
  shouldAutoAccept = () => false,
}: {
  getDraftHost: () => LlmEvaluatorDraftHost | null;
  shouldAutoAccept?: () => boolean;
}) {
  return createEvaluatorSubmitClientAction({
    getDraftHost,
    parseInput: parseEmptyToolInput,
    invalidInputError: `Invalid ${SUBMIT_LLM_EVALUATOR_DRAFT_TOOL_NAME} input. Expected {}.`,
    notMountedError:
      "The LLM-evaluator form is not mounted; cannot submit the draft.",
    shouldAutoAccept,
  });
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
