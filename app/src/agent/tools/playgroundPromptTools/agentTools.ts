import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import {
  READ_PROMPT_TOOLS_TOOL_NAME,
  WRITE_PROMPT_TOOLS_TOOL_NAME,
} from "./constants";
import {
  parseReadPromptToolsInput,
  parseWritePromptToolsInput,
} from "./parsers";
import type { ReadPromptToolsInput, WritePromptToolsInput } from "./types";

export const readPromptToolsAgentTool =
  defineClientActionTool<ReadPromptToolsInput>({
    name: READ_PROMPT_TOOLS_TOOL_NAME,
    parseInput: parseReadPromptToolsInput,
    invalidInputErrorText: `Invalid ${READ_PROMPT_TOOLS_TOOL_NAME} input. Expected { instanceId?: number }.`,
    notMountedErrorText:
      "The playground is not mounted; cannot read prompt tools.",
    defaultSuccessOutput: "Prompt tools read.",
  });

export const writePromptToolsAgentTool =
  defineClientActionTool<WritePromptToolsInput>({
    name: WRITE_PROMPT_TOOLS_TOOL_NAME,
    parseInput: parseWritePromptToolsInput,
    invalidInputErrorText: `Invalid ${WRITE_PROMPT_TOOLS_TOOL_NAME} input. Expected { instanceId: number, expectedRevision: string, tools?: Array<{ id?: number | null, name: string, description?: string | null, parameters?: object | null, strict?: boolean | null }>, deleteToolIds?: number[] } with at least one tool to write or delete.`,
    notMountedErrorText:
      "The playground is not mounted; cannot write prompt tools.",
    defaultSuccessOutput: "Prompt tools written.",
  });
