import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import {
  CLONE_PROMPT_INSTANCE_TOOL_NAME,
  EDIT_PROMPT_TOOL_NAME,
  READ_PROMPT_TOOL_NAME,
} from "./constants";
import {
  parseClonePromptInstanceInput,
  parseEditPromptInput,
  parseReadPromptInput,
} from "./parsers";
import type {
  ClonePromptInstanceInput,
  EditPromptActionContext,
  EditPromptInput,
  ReadPromptInput,
} from "./types";

export const readPromptAgentTool = defineClientActionTool<ReadPromptInput>({
  name: READ_PROMPT_TOOL_NAME,
  parseInput: parseReadPromptInput,
  invalidInputErrorText: `Invalid ${READ_PROMPT_TOOL_NAME} input. Expected { instanceId?: number }.`,
  notMountedErrorText:
    "The playground prompt editor is not mounted; cannot read prompts.",
  defaultSuccessOutput: "Prompt read.",
});

export const clonePromptInstanceAgentTool =
  defineClientActionTool<ClonePromptInstanceInput>({
    name: CLONE_PROMPT_INSTANCE_TOOL_NAME,
    parseInput: parseClonePromptInstanceInput,
    invalidInputErrorText: `Invalid ${CLONE_PROMPT_INSTANCE_TOOL_NAME} input. Expected { instanceId?: number }.`,
    notMountedErrorText:
      "The playground prompt editor is not mounted; cannot clone prompt instances.",
    defaultSuccessOutput: "Prompt instance cloned.",
  });

/**
 * Proposes prompt edits as a pending change accepted or rejected in the UI;
 * success output is deferred to that flow, so only failures surface here.
 */
export const editPromptAgentTool = defineClientActionTool<
  EditPromptInput,
  EditPromptActionContext
>({
  name: EDIT_PROMPT_TOOL_NAME,
  parseInput: parseEditPromptInput,
  invalidInputErrorText: `Invalid ${EDIT_PROMPT_TOOL_NAME} input. Expected { instanceId: number, expectedRevision: string, operations: EditPromptOperation[] }.`,
  notMountedErrorText:
    "The playground prompt editor is not mounted; cannot edit prompts.",
  requireSession: true,
  noSessionErrorText: "Cannot propose prompt edits without an active session.",
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
