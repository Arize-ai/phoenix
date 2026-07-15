import { createEvaluatorSubmitClientAction } from "@phoenix/agent/tools/approval";
import { parseEmptyToolInput } from "@phoenix/agent/tools/emptyToolInput";
import {
  CODE_EVALUATOR_PREVIEW_CONCURRENCY,
  createEvaluatorDraftTestClientAction,
  type EvaluatorPreviewRunnerFactory,
} from "@phoenix/agent/tools/evaluatorDraftPreview";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import {
  SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
} from "./constants";
import {
  parseEditCodeEvaluatorDraftActionContext,
  parseEditCodeEvaluatorDraftInput,
  parseReadCodeEvaluatorDraftInput,
} from "./parsers";
import { bindPendingCodeEvaluatorEditActions } from "./pendingCodeEvaluatorEdit";
import type { CodeEvaluatorDraftHost, PendingCodeEvaluatorEdit } from "./types";

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

    if (shouldAutoAccept()) {
      await pendingEdit.accept?.({ approvalSource: "auto" });
      return { ok: true };
    }

    setPendingCodeEvaluatorEdit(editContext.toolCallId, pendingEdit);
    return { ok: true };
  };
}

export function createSubmitCodeEvaluatorDraftClientAction({
  getDraftHost,
  shouldAutoAccept = () => false,
}: {
  getDraftHost: () => CodeEvaluatorDraftHost | null;
  shouldAutoAccept?: () => boolean;
}) {
  return createEvaluatorSubmitClientAction({
    getDraftHost,
    parseInput: parseEmptyToolInput,
    invalidInputError: `Invalid ${SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME} input. Expected {}.`,
    notMountedError:
      "The code-evaluator form is not mounted; cannot submit the draft.",
    shouldAutoAccept,
  });
}

export function createTestCodeEvaluatorDraftClientAction({
  isDraftMounted,
  createPreviewRunner,
}: {
  isDraftMounted: () => boolean;
  createPreviewRunner: EvaluatorPreviewRunnerFactory;
}) {
  return createEvaluatorDraftTestClientAction({
    toolName: TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
    formLabel: "code-evaluator form",
    isDraftMounted,
    createPreviewRunner,
    concurrency: CODE_EVALUATOR_PREVIEW_CONCURRENCY,
  });
}
