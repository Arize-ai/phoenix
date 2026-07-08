import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import {
  ADD_PROMPT_INSTANCE_TOOL_NAME,
  CLONE_PROMPT_INSTANCE_TOOL_NAME,
  EDIT_PROMPT_TOOL_NAME,
  READ_PROMPT_TOOL_NAME,
  REMOVE_PROMPT_INSTANCE_TOOL_NAME,
} from "./constants";
import {
  parseAddPromptInstanceInput,
  parseClonePromptInstanceInput,
  parseEditPromptInput,
  parseReadPromptInput,
  parseRemovePromptInstanceInput,
} from "./parsers";
import type {
  AddPromptInstanceInput,
  ClonePromptInstanceInput,
  EditPromptActionContext,
  EditPromptInput,
  ReadPromptInput,
  RemovePromptInstanceInput,
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

export const addPromptInstanceAgentTool =
  defineClientActionTool<AddPromptInstanceInput>({
    name: ADD_PROMPT_INSTANCE_TOOL_NAME,
    parseInput: parseAddPromptInstanceInput,
    invalidInputErrorText: `Invalid ${ADD_PROMPT_INSTANCE_TOOL_NAME} input. Expected {}.`,
    notMountedErrorText:
      "The playground prompt editor is not mounted; cannot add prompt instances.",
    defaultSuccessOutput: "Prompt instance added.",
  });

/**
 * Proposes removing a prompt instance as a pending change accepted or rejected
 * in the UI; success output is deferred to that flow, so only failures surface
 * here.
 */
export const removePromptInstanceAgentTool = defineClientActionTool<
  RemovePromptInstanceInput,
  EditPromptActionContext
>({
  name: REMOVE_PROMPT_INSTANCE_TOOL_NAME,
  parseInput: parseRemovePromptInstanceInput,
  invalidInputErrorText: `Invalid ${REMOVE_PROMPT_INSTANCE_TOOL_NAME} input. Expected { instanceId: number }.`,
  notMountedErrorText:
    "The playground prompt editor is not mounted; cannot remove prompt instances.",
  requireSession: true,
  noSessionErrorText:
    "Cannot remove prompt instances without an active session.",
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
