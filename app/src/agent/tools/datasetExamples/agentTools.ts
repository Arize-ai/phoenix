import { getActiveContext } from "@phoenix/agent/context/selectors";
import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";
import { stageDatasetWrite } from "@phoenix/agent/shared/pendingDatasetWrite";

import { commitAddDatasetExamples } from "./addDatasetExamples";
import {
  ADD_DATASET_EXAMPLES_NO_DATASET_ERROR,
  ADD_DATASET_EXAMPLES_TOOL_NAME,
  DELETE_DATASET_EXAMPLES_TOOL_NAME,
  LIST_DATASET_EXAMPLES_NO_DATASET_ERROR,
  LIST_DATASET_EXAMPLES_TOOL_NAME,
  PATCH_DATASET_EXAMPLES_TOOL_NAME,
} from "./constants";
import { commitDeleteDatasetExamples } from "./deleteDatasetExamples";
import { commitListDatasetExamples } from "./listDatasetExamples";
import {
  parseAddDatasetExamplesInput,
  parseDeleteDatasetExamplesInput,
  parseListDatasetExamplesInput,
  parsePatchDatasetExamplesInput,
} from "./parsers";
import { commitPatchDatasetExamples } from "./patchDatasetExamples";
import type {
  AddDatasetExamplesInput,
  DeleteDatasetExamplesInput,
  ListDatasetExamplesInput,
  PatchDatasetExamplesInput,
} from "./types";

export const listDatasetExamplesAgentTool =
  defineTool<ListDatasetExamplesInput>({
    name: LIST_DATASET_EXAMPLES_TOOL_NAME,
    parseInput: parseListDatasetExamplesInput,
    invalidInputErrorText: `Invalid ${LIST_DATASET_EXAMPLES_TOOL_NAME} input. Expected { limit?: number, after?: string, splitNames?: string[] }.`,
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const datasetContext = getActiveContext(agentStore.getState(), "dataset");
      if (!datasetContext) {
        await addToolOutput({
          state: "output-error",
          tool: LIST_DATASET_EXAMPLES_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: LIST_DATASET_EXAMPLES_NO_DATASET_ERROR,
        });
        return;
      }
      const result = await commitListDatasetExamples({
        datasetId: datasetContext.datasetNodeId,
        limit: input.limit,
        after: input.after,
        splitNames: input.splitNames,
      });
      if (result.ok) {
        await addToolOutput({
          state: "output-available",
          tool: LIST_DATASET_EXAMPLES_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          output: result.output,
        });
      } else {
        await addToolOutput({
          state: "output-error",
          tool: LIST_DATASET_EXAMPLES_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: result.error,
        });
      }
    },
  });

export const addDatasetExamplesAgentTool = defineTool<AddDatasetExamplesInput>({
  name: ADD_DATASET_EXAMPLES_TOOL_NAME,
  parseInput: parseAddDatasetExamplesInput,
  invalidInputErrorText: `Invalid ${ADD_DATASET_EXAMPLES_TOOL_NAME} input. Expected { examples: [{ input: object, output?: object, metadata?: object }] }.`,
  uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
  execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      await addToolOutput({
        state: "output-error",
        tool: ADD_DATASET_EXAMPLES_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: ADD_DATASET_EXAMPLES_NO_DATASET_ERROR,
      });
      return;
    }
    const datasetId = datasetContext.datasetNodeId;
    await stageDatasetWrite({
      pending: {
        toolCallId: toolCall.toolCallId,
        toolName: ADD_DATASET_EXAMPLES_TOOL_NAME,
        preview: { kind: "add", examples: input.examples },
      },
      apply: () =>
        commitAddDatasetExamples({ datasetId, examples: input.examples }),
      addToolOutput,
      agentStore,
    });
  },
});

export const patchDatasetExamplesAgentTool =
  defineTool<PatchDatasetExamplesInput>({
    name: PATCH_DATASET_EXAMPLES_TOOL_NAME,
    parseInput: parsePatchDatasetExamplesInput,
    invalidInputErrorText: `Invalid ${PATCH_DATASET_EXAMPLES_TOOL_NAME} input. Expected { patches: [{ exampleId, input?, output?, metadata? }], versionDescription? }.`,
    uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      await stageDatasetWrite({
        pending: {
          toolCallId: toolCall.toolCallId,
          toolName: PATCH_DATASET_EXAMPLES_TOOL_NAME,
          preview: {
            kind: "patch-examples",
            exampleCount: input.patches.length,
          },
        },
        apply: () => commitPatchDatasetExamples(input),
        addToolOutput,
        agentStore,
      });
    },
  });

export const deleteDatasetExamplesAgentTool =
  defineTool<DeleteDatasetExamplesInput>({
    name: DELETE_DATASET_EXAMPLES_TOOL_NAME,
    parseInput: parseDeleteDatasetExamplesInput,
    invalidInputErrorText: `Invalid ${DELETE_DATASET_EXAMPLES_TOOL_NAME} input. Expected { exampleIds: string[], versionDescription? }.`,
    uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      await stageDatasetWrite({
        pending: {
          toolCallId: toolCall.toolCallId,
          toolName: DELETE_DATASET_EXAMPLES_TOOL_NAME,
          preview: {
            kind: "delete-examples",
            exampleCount: input.exampleIds.length,
          },
        },
        apply: () => commitDeleteDatasetExamples(input),
        addToolOutput,
        agentStore,
      });
    },
  });
