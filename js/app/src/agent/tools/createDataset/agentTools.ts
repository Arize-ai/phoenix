import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";
import { stageDatasetWrite } from "@phoenix/agent/shared/pendingDatasetWrite";

import { CREATE_DATASET_TOOL_NAME } from "./constants";
import { commitCreateDataset } from "./createDataset";
import { parseCreateDatasetInput } from "./parsers";
import type { CreateDatasetInput } from "./types";

export const createDatasetAgentTool = defineTool<CreateDatasetInput>({
  name: CREATE_DATASET_TOOL_NAME,
  parseInput: parseCreateDatasetInput,
  invalidInputErrorText: `Invalid ${CREATE_DATASET_TOOL_NAME} input. Expected { name: string, description?: string, examples?: [{ input: object, output?: object, metadata?: object }] }.`,
  uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
  execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
    await stageDatasetWrite({
      pending: {
        toolCallId: toolCall.toolCallId,
        toolName: CREATE_DATASET_TOOL_NAME,
        preview: {
          kind: "create",
          name: input.name,
          description: input.description,
          examples: input.examples,
        },
      },
      apply: () => commitCreateDataset(input),
      addToolOutput,
      agentStore,
    });
  },
});
