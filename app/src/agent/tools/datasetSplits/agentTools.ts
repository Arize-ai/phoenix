import { getActiveContext } from "@phoenix/agent/context/selectors";
import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";
import { stageDatasetWrite } from "@phoenix/agent/shared/pendingDatasetWrite";
import { verifyExamplesInDataset } from "@phoenix/agent/shared/verifyExamplesInDataset";

import {
  CREATE_DATASET_SPLIT_TOOL_NAME,
  DATASET_SPLITS_NO_DATASET_ERROR,
  DEFAULT_DATASET_SPLIT_COLOR,
  DELETE_DATASET_SPLITS_TOOL_NAME,
  LIST_DATASET_SPLITS_TOOL_NAME,
  LIST_SPLITS_TOOL_NAME,
  PATCH_DATASET_SPLIT_TOOL_NAME,
  SET_DATASET_EXAMPLE_SPLITS_TOOL_NAME,
} from "./constants";
import { commitCreateDatasetSplit } from "./createDatasetSplit";
import { commitDeleteDatasetSplits } from "./deleteDatasetSplits";
import { commitListDatasetSplits } from "./listDatasetSplits";
import { commitListSplits } from "./listSplits";
import {
  parseCreateDatasetSplitInput,
  parseDeleteDatasetSplitsInput,
  parseListDatasetSplitsInput,
  parseListSplitsInput,
  parsePatchDatasetSplitInput,
  parseSetDatasetExampleSplitsInput,
} from "./parsers";
import { commitPatchDatasetSplit } from "./patchDatasetSplit";
import { commitSetDatasetExampleSplits } from "./setDatasetExampleSplits";
import type {
  CreateDatasetSplitInput,
  DeleteDatasetSplitsInput,
  ListDatasetSplitsInput,
  ListSplitsInput,
  PatchDatasetSplitInput,
  SetDatasetExampleSplitsInput,
} from "./types";

export const listDatasetSplitsAgentTool = defineTool<ListDatasetSplitsInput>({
  name: LIST_DATASET_SPLITS_TOOL_NAME,
  parseInput: parseListDatasetSplitsInput,
  invalidInputErrorText: `Invalid ${LIST_DATASET_SPLITS_TOOL_NAME} input. Expected {}.`,
  execute: async ({ toolCall, addToolOutput, agentStore }) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      await addToolOutput({
        state: "output-error",
        tool: LIST_DATASET_SPLITS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: DATASET_SPLITS_NO_DATASET_ERROR,
      });
      return;
    }
    const result = await commitListDatasetSplits({
      datasetId: datasetContext.datasetNodeId,
    });
    if (result.ok) {
      await addToolOutput({
        state: "output-available",
        tool: LIST_DATASET_SPLITS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: result.output,
      });
    } else {
      await addToolOutput({
        state: "output-error",
        tool: LIST_DATASET_SPLITS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});

export const listSplitsAgentTool = defineTool<ListSplitsInput>({
  name: LIST_SPLITS_TOOL_NAME,
  parseInput: parseListSplitsInput,
  invalidInputErrorText: `Invalid ${LIST_SPLITS_TOOL_NAME} input. Expected { limit?: number, after?: string }.`,
  execute: async ({ toolCall, input, addToolOutput }) => {
    const result = await commitListSplits({
      limit: input.limit,
      after: input.after,
    });
    if (result.ok) {
      await addToolOutput({
        state: "output-available",
        tool: LIST_SPLITS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: result.output,
      });
    } else {
      await addToolOutput({
        state: "output-error",
        tool: LIST_SPLITS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});

export const createDatasetSplitAgentTool = defineTool<CreateDatasetSplitInput>({
  name: CREATE_DATASET_SPLIT_TOOL_NAME,
  parseInput: parseCreateDatasetSplitInput,
  invalidInputErrorText: `Invalid ${CREATE_DATASET_SPLIT_TOOL_NAME} input. Expected { name: string, description?: string, color?: string, exampleIds?: string[] }.`,
  uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
  execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
    await stageDatasetWrite({
      pending: {
        toolCallId: toolCall.toolCallId,
        toolName: CREATE_DATASET_SPLIT_TOOL_NAME,
        preview: {
          kind: "create-split",
          name: input.name,
          description: input.description,
          color: input.color ?? DEFAULT_DATASET_SPLIT_COLOR,
          exampleCount: input.exampleIds?.length ?? 0,
        },
      },
      apply: () => commitCreateDatasetSplit(input),
      addToolOutput,
      agentStore,
    });
  },
});

export const setDatasetExampleSplitsAgentTool =
  defineTool<SetDatasetExampleSplitsInput>({
    name: SET_DATASET_EXAMPLE_SPLITS_TOOL_NAME,
    parseInput: parseSetDatasetExampleSplitsInput,
    invalidInputErrorText: `Invalid ${SET_DATASET_EXAMPLE_SPLITS_TOOL_NAME} input. Expected { exampleIds: string[], splitNames: string[] }.`,
    uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const datasetContext = getActiveContext(agentStore.getState(), "dataset");
      if (!datasetContext) {
        await addToolOutput({
          state: "output-error",
          tool: SET_DATASET_EXAMPLE_SPLITS_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: DATASET_SPLITS_NO_DATASET_ERROR,
        });
        return;
      }
      // The mutation is applied per example with no cross-dataset guard, so
      // validate every id against the dataset in view up front — this is what
      // prevents both wrong-dataset writes and most partial-failure paths.
      const membership = await verifyExamplesInDataset({
        datasetId: datasetContext.datasetNodeId,
        exampleIds: input.exampleIds,
      });
      if (!membership.ok) {
        await addToolOutput({
          state: "output-error",
          tool: SET_DATASET_EXAMPLE_SPLITS_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: membership.error,
        });
        return;
      }
      await stageDatasetWrite({
        pending: {
          toolCallId: toolCall.toolCallId,
          toolName: SET_DATASET_EXAMPLE_SPLITS_TOOL_NAME,
          preview: {
            kind: "set-splits",
            datasetName: membership.datasetName,
            splitNames: input.splitNames,
            exampleIds: input.exampleIds,
          },
        },
        apply: () =>
          commitSetDatasetExampleSplits({
            datasetId: datasetContext.datasetNodeId,
            exampleIds: input.exampleIds,
            splitNames: input.splitNames,
          }),
        addToolOutput,
        agentStore,
      });
    },
  });

export const patchDatasetSplitAgentTool = defineTool<PatchDatasetSplitInput>({
  name: PATCH_DATASET_SPLIT_TOOL_NAME,
  parseInput: parsePatchDatasetSplitInput,
  invalidInputErrorText: `Invalid ${PATCH_DATASET_SPLIT_TOOL_NAME} input. Expected { splitName: string } plus at least one of { name?, description?, color? }.`,
  uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
  execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      await addToolOutput({
        state: "output-error",
        tool: PATCH_DATASET_SPLIT_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: DATASET_SPLITS_NO_DATASET_ERROR,
      });
      return;
    }
    const { splitName, ...changes } = input;
    await stageDatasetWrite({
      pending: {
        toolCallId: toolCall.toolCallId,
        toolName: PATCH_DATASET_SPLIT_TOOL_NAME,
        preview: { kind: "patch-split", splitName, changes: { ...changes } },
      },
      apply: () => commitPatchDatasetSplit(input),
      addToolOutput,
      agentStore,
    });
  },
});

export const deleteDatasetSplitsAgentTool =
  defineTool<DeleteDatasetSplitsInput>({
    name: DELETE_DATASET_SPLITS_TOOL_NAME,
    parseInput: parseDeleteDatasetSplitsInput,
    invalidInputErrorText: `Invalid ${DELETE_DATASET_SPLITS_TOOL_NAME} input. Expected { splitNames: string[] }.`,
    uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const datasetContext = getActiveContext(agentStore.getState(), "dataset");
      if (!datasetContext) {
        await addToolOutput({
          state: "output-error",
          tool: DELETE_DATASET_SPLITS_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: DATASET_SPLITS_NO_DATASET_ERROR,
        });
        return;
      }
      await stageDatasetWrite({
        pending: {
          toolCallId: toolCall.toolCallId,
          toolName: DELETE_DATASET_SPLITS_TOOL_NAME,
          preview: { kind: "delete-splits", splitNames: input.splitNames },
        },
        apply: () =>
          commitDeleteDatasetSplits({ splitNames: input.splitNames }),
        addToolOutput,
        agentStore,
      });
    },
  });
