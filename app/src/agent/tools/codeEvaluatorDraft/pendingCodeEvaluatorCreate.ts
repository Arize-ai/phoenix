import { dispatchCreateCodeEvaluator } from "@phoenix/agent/tools/createCodeEvaluator/dispatch";
import type { CreateCodeEvaluatorInput } from "@phoenix/agent/tools/createCodeEvaluator/types";

import { CREATE_CODE_EVALUATOR_NAVIGATION_CANCEL_ERROR } from "./constants";
import type {
  BindPendingCodeEvaluatorCreateHandoffOptions,
  BindPendingCodeEvaluatorCreateInlineOptions,
  PendingCodeEvaluatorCreateHandoff,
  PendingCodeEvaluatorCreateInline,
} from "./types";

export const CREATE_CODE_EVALUATOR_TOOL_NAME = "create_code_evaluator";

const USER_REJECTED_MESSAGE =
  "User rejected the proposed code-evaluator creation.";
const USER_DISMISSED_EDITOR_MESSAGE = "User dismissed the editor.";

/**
 * Build a `CreateCodeEvaluatorInput` from the proposed snapshot. The snapshot
 * already encodes everything the create mutation needs; this is just a shape
 * adapter so the dispatch layer stays decoupled from the snapshot type.
 */
function inputFromPendingCreate(
  pendingCreate: Pick<PendingCodeEvaluatorCreateInline, "after">
): CreateCodeEvaluatorInput {
  const after = pendingCreate.after;
  if (after.sandboxConfigId === null) {
    throw new Error(
      "PendingCodeEvaluatorCreate is missing sandbox_config_id; the create proposal was built with an invalid snapshot."
    );
  }
  return {
    name: after.name,
    sourceCode: after.sourceCode,
    language: after.language,
    description: after.description.length > 0 ? after.description : undefined,
    sandboxConfigId: after.sandboxConfigId,
    inputMapping: after.inputMapping,
    outputConfigs: after.outputConfigs,
  };
}

export function bindPendingCodeEvaluatorCreateInlineActions({
  pendingCreate,
  addToolOutput,
  setPendingCodeEvaluatorCreate,
}: BindPendingCodeEvaluatorCreateInlineOptions): PendingCodeEvaluatorCreateInline {
  return {
    ...pendingCreate,
    kind: "inline",
    accept: async () => {
      setPendingCodeEvaluatorCreate(pendingCreate.toolCallId, null);

      let input: CreateCodeEvaluatorInput;
      try {
        input = inputFromPendingCreate(pendingCreate);
      } catch (error) {
        await addToolOutput({
          state: "output-error",
          tool: CREATE_CODE_EVALUATOR_TOOL_NAME,
          toolCallId: pendingCreate.toolCallId,
          errorText:
            error instanceof Error
              ? error.message
              : "Could not build createCodeEvaluator input.",
        });
        return;
      }

      const result = await dispatchCreateCodeEvaluator(input, {
        datasetContext: null,
        connectionIds: [],
      });
      if (!result.ok) {
        await addToolOutput({
          state: "output-error",
          tool: CREATE_CODE_EVALUATOR_TOOL_NAME,
          toolCallId: pendingCreate.toolCallId,
          errorText: result.error,
        });
        return;
      }
      await addToolOutput({
        state: "output-available",
        tool: CREATE_CODE_EVALUATOR_TOOL_NAME,
        toolCallId: pendingCreate.toolCallId,
        output: JSON.stringify({
          status: "accepted",
          createdEvaluator: result.evaluator,
          datasetEvaluatorId: result.datasetEvaluatorId,
        }),
      });
    },
    reject: async () => {
      setPendingCodeEvaluatorCreate(pendingCreate.toolCallId, null);
      await addToolOutput({
        state: "output-available",
        tool: CREATE_CODE_EVALUATOR_TOOL_NAME,
        toolCallId: pendingCreate.toolCallId,
        output: JSON.stringify({
          status: "rejected",
          message: USER_REJECTED_MESSAGE,
        }),
      });
    },
    cancel: async () => {
      setPendingCodeEvaluatorCreate(pendingCreate.toolCallId, null);
      await addToolOutput({
        state: "output-error",
        tool: CREATE_CODE_EVALUATOR_TOOL_NAME,
        toolCallId: pendingCreate.toolCallId,
        errorText: CREATE_CODE_EVALUATOR_NAVIGATION_CANCEL_ERROR,
      });
    },
  };
}

/**
 * Bind the three terminal resolvers + cancel for a dataset-handoff proposal.
 *
 * Each resolver flips the `resolved` flag on the live store entry before
 * calling `addToolOutput`, and short-circuits when the entry is already
 * resolved. This is load-bearing: the slideover's `onOpenChange(false)` fires
 * after a successful Save (close-after-save), so the close handler must skip
 * `resolveAsRejected` once `resolved === true`.
 */
export function bindPendingCodeEvaluatorCreateHandoffActions({
  pendingCreate,
  addToolOutput,
  setPendingCodeEvaluatorCreate,
}: BindPendingCodeEvaluatorCreateHandoffOptions): PendingCodeEvaluatorCreateHandoff {
  const toolCallId = pendingCreate.toolCallId;
  const bound: PendingCodeEvaluatorCreateHandoff = {
    ...pendingCreate,
    kind: "handoff",
  };

  const tryClaim = (): boolean => {
    if (bound.resolved) return false;
    bound.resolved = true;
    return true;
  };

  bound.resolveAsAccepted = async (result) => {
    if (!tryClaim()) return;
    setPendingCodeEvaluatorCreate(toolCallId, null);
    await addToolOutput({
      state: "output-available",
      tool: CREATE_CODE_EVALUATOR_TOOL_NAME,
      toolCallId,
      output: JSON.stringify({
        status: "accepted",
        createdEvaluator: result.createdEvaluator,
        datasetEvaluatorId: result.datasetEvaluatorId,
      }),
    });
  };
  bound.resolveAsRejected = async (message) => {
    if (!tryClaim()) return;
    setPendingCodeEvaluatorCreate(toolCallId, null);
    await addToolOutput({
      state: "output-available",
      tool: CREATE_CODE_EVALUATOR_TOOL_NAME,
      toolCallId,
      output: JSON.stringify({
        status: "rejected",
        message: message ?? USER_DISMISSED_EDITOR_MESSAGE,
      }),
    });
  };
  bound.resolveAsFailed = async (errorMessage) => {
    if (!tryClaim()) return;
    setPendingCodeEvaluatorCreate(toolCallId, null);
    await addToolOutput({
      state: "output-error",
      tool: CREATE_CODE_EVALUATOR_TOOL_NAME,
      toolCallId,
      errorText: errorMessage,
    });
  };
  bound.cancel = async () => {
    if (!tryClaim()) return;
    setPendingCodeEvaluatorCreate(toolCallId, null);
    await addToolOutput({
      state: "output-error",
      tool: CREATE_CODE_EVALUATOR_TOOL_NAME,
      toolCallId,
      errorText: CREATE_CODE_EVALUATOR_NAVIGATION_CANCEL_ERROR,
    });
  };

  return bound;
}
