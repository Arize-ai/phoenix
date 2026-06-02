import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";

import { ASK_USER_TOOL_NAME } from "./constants";
import { parseElicitToolInput } from "./elicitToolSchema";
import type { ElicitToolInput } from "./elicitToolTypes";

/** ask_user pauses tool execution until the user answers in the UI. */
export const askUserAgentTool = defineTool<ElicitToolInput>({
  name: ASK_USER_TOOL_NAME,
  parseInput: parseElicitToolInput,
  invalidInputErrorText:
    "Invalid ask_user tool input. Expected { questions: ElicitationQuestion[] }.",
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    agentStore,
  }) => {
    if (!sessionId) {
      await addToolOutput({
        state: "output-error",
        tool: ASK_USER_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: "Cannot ask user questions without an active session.",
      });
      return;
    }

    agentStore.getState().setPendingElicitation(sessionId, {
      toolCallId: toolCall.toolCallId,
      questions: input.questions,
    });
  },
});
