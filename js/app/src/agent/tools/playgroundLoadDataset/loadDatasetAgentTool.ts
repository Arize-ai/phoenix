import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { LOAD_DATASET_TOOL_NAME } from "./constants";
import { parseLoadDatasetInput } from "./parsers";
import type { LoadDatasetActionContext, LoadDatasetInput } from "./types";

/**
 * Loads a dataset into the playground as a pending change the user accepts or
 * rejects; requires an active session to attribute the change, and defers
 * success output to that flow.
 */
export const loadDatasetAgentTool = defineClientActionTool<
  LoadDatasetInput,
  LoadDatasetActionContext
>({
  name: LOAD_DATASET_TOOL_NAME,
  parseInput: parseLoadDatasetInput,
  invalidInputErrorText: `Invalid ${LOAD_DATASET_TOOL_NAME} input. Expected { datasetName: string, splitName?: string }.`,
  notMountedErrorText:
    "The playground is not mounted; cannot load a dataset into the playground.",
  requireSession: true,
  noSessionErrorText: "Cannot load a dataset without an active session.",
  buildContext: ({ toolCall, sessionId, addToolOutput }) => ({
    toolCallId: toolCall.toolCallId,
    sessionId,
    addToolOutput,
  }),
  emitSuccess: false,
  uiBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
});
