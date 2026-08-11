import { createEvaluatorSubmitClientAction } from "@phoenix/agent/tools/approval";
import { parseEmptyToolInput } from "@phoenix/agent/tools/emptyToolInput";
import { parseUiOperationCallContext } from "@phoenix/agent/uiOperations/types";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import { SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME } from "./constants";
import {
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
    const callContext = parseUiOperationCallContext(context);
    if (!callContext) {
      return {
        ok: false,
        error:
          "Cannot propose code-evaluator draft edit without an operation call context.",
      };
    }
    const parsed = parseEditCodeEvaluatorDraftInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid evaluators.code.edit input.",
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

    // The returned promise resolves when the user (or bypass mode) decides;
    // the awaiting execute_ui script sits parked on it until then.
    return new Promise((resolve) => {
      const pendingEdit = bindPendingCodeEvaluatorEditActions({
        pendingEdit: {
          toolCallId: callContext.callId,
          sessionId: callContext.sessionId ?? "",
          before,
          after: proposed.output,
          operations: parsed.operations,
        },
        draftHost: host,
        emitResult: resolve,
        setPendingCodeEvaluatorEdit,
      });

      if (shouldAutoAccept()) {
        void pendingEdit.accept?.({ approvalSource: "auto" });
        return;
      }

      setPendingCodeEvaluatorEdit(callContext.callId, pendingEdit);
    });
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
