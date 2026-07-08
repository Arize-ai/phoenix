import { getActiveContext } from "@phoenix/agent/context/selectors";
import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";
import { stageDatasetWrite } from "@phoenix/agent/shared/pendingDatasetWrite";

import {
  CREATE_DATASET_LABEL_TOOL_NAME,
  DATASET_LABELS_NO_DATASET_ERROR,
  DEFAULT_DATASET_LABEL_COLOR,
  DELETE_DATASET_LABELS_TOOL_NAME,
  LIST_DATASET_LABELS_TOOL_NAME,
  LIST_LABELS_TOOL_NAME,
  SET_DATASET_LABELS_TOOL_NAME,
} from "./constants";
import { commitCreateDatasetLabel } from "./createDatasetLabel";
import { commitDeleteDatasetLabels } from "./deleteDatasetLabels";
import { commitListDatasetLabels } from "./listDatasetLabels";
import { commitListLabels } from "./listLabels";
import {
  parseCreateDatasetLabelInput,
  parseDeleteDatasetLabelsInput,
  parseListDatasetLabelsInput,
  parseListLabelsInput,
  parseSetDatasetLabelsInput,
} from "./parsers";
import { commitSetDatasetLabels } from "./setDatasetLabels";
import type {
  CreateDatasetLabelInput,
  DeleteDatasetLabelsInput,
  ListDatasetLabelsInput,
  ListLabelsInput,
  SetDatasetLabelsInput,
} from "./types";

export const listDatasetLabelsAgentTool = defineTool<ListDatasetLabelsInput>({
  name: LIST_DATASET_LABELS_TOOL_NAME,
  parseInput: parseListDatasetLabelsInput,
  invalidInputErrorText: `Invalid ${LIST_DATASET_LABELS_TOOL_NAME} input. Expected {}.`,
  execute: async ({ toolCall, addToolOutput, agentStore }) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      await addToolOutput({
        state: "output-error",
        tool: LIST_DATASET_LABELS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: DATASET_LABELS_NO_DATASET_ERROR,
      });
      return;
    }
    const result = await commitListDatasetLabels({
      datasetId: datasetContext.datasetNodeId,
    });
    if (result.ok) {
      await addToolOutput({
        state: "output-available",
        tool: LIST_DATASET_LABELS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: result.output,
      });
    } else {
      await addToolOutput({
        state: "output-error",
        tool: LIST_DATASET_LABELS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});

export const listLabelsAgentTool = defineTool<ListLabelsInput>({
  name: LIST_LABELS_TOOL_NAME,
  parseInput: parseListLabelsInput,
  invalidInputErrorText: `Invalid ${LIST_LABELS_TOOL_NAME} input. Expected { limit?: number, after?: string }.`,
  execute: async ({ toolCall, input, addToolOutput }) => {
    const result = await commitListLabels({
      limit: input.limit,
      after: input.after,
    });
    if (result.ok) {
      await addToolOutput({
        state: "output-available",
        tool: LIST_LABELS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: result.output,
      });
    } else {
      await addToolOutput({
        state: "output-error",
        tool: LIST_LABELS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});

export const createDatasetLabelAgentTool = defineTool<CreateDatasetLabelInput>({
  name: CREATE_DATASET_LABEL_TOOL_NAME,
  parseInput: parseCreateDatasetLabelInput,
  invalidInputErrorText: `Invalid ${CREATE_DATASET_LABEL_TOOL_NAME} input. Expected { name: string, description?: string, color?: string, attachToDataset?: boolean }.`,
  uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
  execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      await addToolOutput({
        state: "output-error",
        tool: CREATE_DATASET_LABEL_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: DATASET_LABELS_NO_DATASET_ERROR,
      });
      return;
    }
    const datasetId = datasetContext.datasetNodeId;
    await stageDatasetWrite({
      pending: {
        toolCallId: toolCall.toolCallId,
        toolName: CREATE_DATASET_LABEL_TOOL_NAME,
        preview: {
          kind: "create-label",
          name: input.name,
          description: input.description,
          color: input.color ?? DEFAULT_DATASET_LABEL_COLOR,
          attachToDataset: input.attachToDataset !== false,
        },
      },
      apply: () => commitCreateDatasetLabel({ datasetId, ...input }),
      addToolOutput,
      agentStore,
    });
  },
});

export const setDatasetLabelsAgentTool = defineTool<SetDatasetLabelsInput>({
  name: SET_DATASET_LABELS_TOOL_NAME,
  parseInput: parseSetDatasetLabelsInput,
  invalidInputErrorText: `Invalid ${SET_DATASET_LABELS_TOOL_NAME} input. Expected { labelNames: string[] }.`,
  uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
  execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      await addToolOutput({
        state: "output-error",
        tool: SET_DATASET_LABELS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: DATASET_LABELS_NO_DATASET_ERROR,
      });
      return;
    }
    const datasetId = datasetContext.datasetNodeId;
    await stageDatasetWrite({
      pending: {
        toolCallId: toolCall.toolCallId,
        toolName: SET_DATASET_LABELS_TOOL_NAME,
        preview: { kind: "set-labels", labelNames: input.labelNames },
      },
      apply: () =>
        commitSetDatasetLabels({ datasetId, labelNames: input.labelNames }),
      addToolOutput,
      agentStore,
    });
  },
});

export const deleteDatasetLabelsAgentTool =
  defineTool<DeleteDatasetLabelsInput>({
    name: DELETE_DATASET_LABELS_TOOL_NAME,
    parseInput: parseDeleteDatasetLabelsInput,
    invalidInputErrorText: `Invalid ${DELETE_DATASET_LABELS_TOOL_NAME} input. Expected { labelNames: string[] }.`,
    uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const datasetContext = getActiveContext(agentStore.getState(), "dataset");
      if (!datasetContext) {
        await addToolOutput({
          state: "output-error",
          tool: DELETE_DATASET_LABELS_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: DATASET_LABELS_NO_DATASET_ERROR,
        });
        return;
      }
      await stageDatasetWrite({
        pending: {
          toolCallId: toolCall.toolCallId,
          toolName: DELETE_DATASET_LABELS_TOOL_NAME,
          preview: { kind: "delete-labels", labelNames: input.labelNames },
        },
        apply: () =>
          commitDeleteDatasetLabels({ labelNames: input.labelNames }),
        addToolOutput,
        agentStore,
      });
    },
  });
