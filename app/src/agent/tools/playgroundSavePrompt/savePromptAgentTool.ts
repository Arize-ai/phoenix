import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { SAVE_PROMPT_TOOL_NAME } from "./constants";
import { parseSavePromptInput } from "./parsers";
import type { SavePromptInput, SavePromptToolOutputSender } from "./types";

/** Context passed as the save_prompt client action's second argument. */
type SavePromptActionContext = {
  toolCallId: string;
  sessionId: string;
  addToolOutput: SavePromptToolOutputSender;
};

/**
 * Proposes saving the current prompt as a pending change accepted or rejected
 * in the UI; success output is deferred to that flow, so only failures surface
 * here.
 */
export const savePromptAgentTool = defineClientActionTool<
  SavePromptInput,
  SavePromptActionContext
>({
  name: SAVE_PROMPT_TOOL_NAME,
  parseInput: parseSavePromptInput,
  invalidInputErrorText: `Invalid ${SAVE_PROMPT_TOOL_NAME} input. Expected { description: string, instanceId?: number, promptId?: string, name?: string, tags?: string[] }.`,
  notMountedErrorText:
    "The playground prompt editor is not mounted; cannot save prompts.",
  requireSession: true,
  noSessionErrorText: "Cannot save prompts without an active session.",
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
