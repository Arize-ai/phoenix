import { createEvaluatorSubmitClientAction } from "@phoenix/agent/tools/approval";
import { parseEmptyToolInput } from "@phoenix/agent/tools/emptyToolInput";
import {
  createEvaluatorDraftTestClientAction,
  LLM_EVALUATOR_PREVIEW_CONCURRENCY,
  type EvaluatorPreviewRunnerFactory,
} from "@phoenix/agent/tools/evaluatorDraftPreview";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import {
  SUBMIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME,
} from "./constants";
import {
  parseEditLlmEvaluatorDraftActionContext,
  parseEditLlmEvaluatorDraftInput,
  parseReadLlmEvaluatorDraftInput,
} from "./parsers";
import { bindPendingLlmEvaluatorEditActions } from "./pendingLlmEvaluatorEdit";
import type { LlmEvaluatorDraftHost, PendingLlmEvaluatorEdit } from "./types";

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
  createPreviewRunner,
}: {
  isDraftMounted: () => boolean;
  createPreviewRunner: EvaluatorPreviewRunnerFactory;
}) {
  return createEvaluatorDraftTestClientAction({
    toolName: TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME,
    formLabel: "LLM-evaluator form",
    isDraftMounted,
    createPreviewRunner,
    concurrency: LLM_EVALUATOR_PREVIEW_CONCURRENCY,
  });
}
