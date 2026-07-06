import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";
import { requireToolSession } from "@phoenix/agent/extensions/registry/requireToolSession";

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
    const session = await requireToolSession({
      toolName: ASK_USER_TOOL_NAME,
      toolCall,
      sessionId,
      addToolOutput,
      errorText: "Cannot ask user questions without an active session.",
    });
    if (session == null) return;

    agentStore.getState().setPendingElicitation(session, {
      toolCallId: toolCall.toolCallId,
      questions: input.questions,
    });
  },
});
