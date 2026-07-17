import { getActiveContext } from "@phoenix/agent/context/selectors";
import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";
import { stageDatasetWrite } from "@phoenix/agent/shared/pendingDatasetWrite";

import {
  DATASET_EDIT_NO_DATASET_ERROR,
  DELETE_DATASET_TOOL_NAME,
  PATCH_DATASET_TOOL_NAME,
} from "./constants";
import { commitDeleteDataset, resolveDatasetName } from "./deleteDataset";
import { parseDeleteDatasetInput, parsePatchDatasetInput } from "./parsers";
import { commitPatchDataset } from "./patchDataset";
import type { DeleteDatasetInput, PatchDatasetInput } from "./types";

export const patchDatasetAgentTool = defineTool<PatchDatasetInput>({
  name: PATCH_DATASET_TOOL_NAME,
  parseInput: parsePatchDatasetInput,
  invalidInputErrorText: `Invalid ${PATCH_DATASET_TOOL_NAME} input. Expected at least one of { name?: string, description?: string, metadata?: object }.`,
  uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    agentStore,
  }) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      await addToolOutput({
        state: "output-error",
        tool: PATCH_DATASET_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: DATASET_EDIT_NO_DATASET_ERROR,
      });
      return;
    }
    const datasetId = datasetContext.datasetNodeId;
    await stageDatasetWrite({
      sessionId,
      pending: {
        toolCallId: toolCall.toolCallId,
        toolName: PATCH_DATASET_TOOL_NAME,
        preview: { kind: "patch-dataset", changes: { ...input } },
      },
      apply: () => commitPatchDataset({ datasetId, ...input }),
      addToolOutput,
      agentStore,
    });
  },
});

export const deleteDatasetAgentTool = defineTool<DeleteDatasetInput>({
  name: DELETE_DATASET_TOOL_NAME,
  parseInput: parseDeleteDatasetInput,
  invalidInputErrorText: `Invalid ${DELETE_DATASET_TOOL_NAME} input. Expected {}.`,
  uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
  execute: async ({ toolCall, sessionId, addToolOutput, agentStore }) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      await addToolOutput({
        state: "output-error",
        tool: DELETE_DATASET_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: DATASET_EDIT_NO_DATASET_ERROR,
      });
      return;
    }
    const datasetId = datasetContext.datasetNodeId;
    const datasetName = (await resolveDatasetName(datasetId)) ?? datasetId;
    await stageDatasetWrite({
      sessionId,
      pending: {
        toolCallId: toolCall.toolCallId,
        toolName: DELETE_DATASET_TOOL_NAME,
        preview: { kind: "delete-dataset", datasetName },
      },
      apply: () => commitDeleteDataset({ datasetId }),
      addToolOutput,
      agentStore,
    });
  },
});
