import { dispatchCreateCodeEvaluator } from "@phoenix/agent/tools/createCodeEvaluator/dispatch";
import type { CreateCodeEvaluatorInput } from "@phoenix/agent/tools/createCodeEvaluator/types";

import { CREATE_CODE_EVALUATOR_NAVIGATION_CANCEL_ERROR } from "./constants";
import type {
  BindPendingCodeEvaluatorCreateOptions,
  PendingCodeEvaluatorCreate,
  PendingCodeEvaluatorCreateDatasetSnapshot,
} from "./types";

export const CREATE_CODE_EVALUATOR_TOOL_NAME = "create_code_evaluator";

function datasetContextMatches(
  snapshot: PendingCodeEvaluatorCreateDatasetSnapshot,
  current: PendingCodeEvaluatorCreateDatasetSnapshot | null
): boolean {
  if (current === null) return false;
  if (current.datasetNodeId !== snapshot.datasetNodeId) return false;
  if (snapshot.datasetVersionNodeId === null) {
    return current.datasetVersionNodeId === null;
  }
  return current.datasetVersionNodeId === snapshot.datasetVersionNodeId;
}

/**
 * Build a `CreateCodeEvaluatorInput` from the proposed snapshot. The snapshot
 * already encodes everything the create mutation needs; this is just a shape
 * adapter so the dispatch layer stays decoupled from the snapshot type.
 */
function inputFromPendingCreate(
  pendingCreate: PendingCodeEvaluatorCreate
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
  getActiveDatasetContext,
}: BindPendingCodeEvaluatorCreateOptions): PendingCodeEvaluatorCreate {
  return {
    ...pendingCreate,
    accept: async () => {
      setPendingCodeEvaluatorCreate(pendingCreate.toolCallId, null);

      if (pendingCreate.datasetContext !== null) {
        const live = getActiveDatasetContext();
        if (!datasetContextMatches(pendingCreate.datasetContext, live)) {
          await addToolOutput({
            state: "output-error",
            tool: CREATE_CODE_EVALUATOR_TOOL_NAME,
            toolCallId: pendingCreate.toolCallId,
            errorText:
              "The active dataset changed after this evaluator was proposed, so it can no longer be created against the original dataset.",
          });
          return;
        }
      }

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
        connectionIds: pendingCreate.connectionIds,
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
          message: "User rejected the proposed code-evaluator creation.",
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
