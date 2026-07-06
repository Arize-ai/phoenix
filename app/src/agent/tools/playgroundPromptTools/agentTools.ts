import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import {
  READ_PROMPT_TOOLS_TOOL_NAME,
  WRITE_PROMPT_TOOLS_TOOL_NAME,
} from "./constants";
import {
  parseReadPromptToolsInput,
  parseWritePromptToolsInput,
} from "./parsers";
import type {
  PromptToolsActionContext,
  ReadPromptToolsInput,
  WritePromptToolsInput,
} from "./types";

export const readPromptToolsAgentTool =
  defineClientActionTool<ReadPromptToolsInput>({
    name: READ_PROMPT_TOOLS_TOOL_NAME,
    parseInput: parseReadPromptToolsInput,
    invalidInputErrorText: `Invalid ${READ_PROMPT_TOOLS_TOOL_NAME} input. Expected { instanceId?: number }.`,
    notMountedErrorText:
      "The playground is not mounted; cannot read prompt tools.",
    defaultSuccessOutput: "Prompt tools read.",
  });

/**
 * Proposes prompt-tool changes as a pending diff the user accepts or rejects;
 * requires an active session to attribute the change, and defers success output
 * to that flow.
 */
export const writePromptToolsAgentTool = defineClientActionTool<
  WritePromptToolsInput,
  PromptToolsActionContext
>({
  name: WRITE_PROMPT_TOOLS_TOOL_NAME,
  parseInput: parseWritePromptToolsInput,
  invalidInputErrorText: `Invalid ${WRITE_PROMPT_TOOLS_TOOL_NAME} input. Expected { instanceId: number, expectedRevision: string, tools?: Array<{ id?: number | null, name: string, description?: string | null, parameters?: object | null, strict?: boolean | null }>, deleteToolIds?: number[] } with at least one tool to write or delete.`,
  notMountedErrorText:
    "The playground is not mounted; cannot write prompt tools.",
  requireSession: true,
  noSessionErrorText:
    "Cannot propose prompt tool changes without an active session.",
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
