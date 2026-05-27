import { dispatchCreateCodeEvaluator } from "@phoenix/agent/tools/createCodeEvaluator/dispatch";
import type { CreateCodeEvaluatorInput } from "@phoenix/agent/tools/createCodeEvaluator/types";

import { CREATE_CODE_EVALUATOR_NAVIGATION_CANCEL_ERROR } from "./constants";
import type {
  BindPendingCodeEvaluatorCreateOptions,
  PendingCodeEvaluatorCreate,
} from "./types";

export const CREATE_CODE_EVALUATOR_TOOL_NAME = "create_code_evaluator";

const USER_REJECTED_MESSAGE =
  "User rejected the proposed code-evaluator creation.";

/**
 * Build a `CreateCodeEvaluatorInput` from the proposed snapshot. The snapshot
 * already encodes everything the create mutation needs; this is just a shape
 * adapter so the dispatch layer stays decoupled from the snapshot type.
 */
function inputFromPendingCreate(
  pendingCreate: Pick<PendingCodeEvaluatorCreate, "after">
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

export function bindPendingCodeEvaluatorCreateActions({
  pendingCreate,
  addToolOutput,
  setPendingCodeEvaluatorCreate,
}: BindPendingCodeEvaluatorCreateOptions): PendingCodeEvaluatorCreate {
  return {
    ...pendingCreate,
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
        datasetContext: pendingCreate.datasetContext,
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
