import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";

import { getBashToolInput } from "./bashToolSchema";
import type { BashToolInput } from "./bashToolSchema";
import { BASH_TOOL_NAME } from "./constants";
import { handleBashToolCall } from "./handleBashToolCall";

/** Bash runs in the browser sandbox and is gated by runtime capabilities. */
export const bashAgentTool = defineTool<BashToolInput>({
  name: BASH_TOOL_NAME,
  parseInput: getBashToolInput,
  invalidInputErrorText: "Invalid bash tool input",
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    capabilities,
  }) => {
    await handleBashToolCall({
      toolCallId: toolCall.toolCallId,
      input,
      sessionId,
      addToolOutput,
      capabilities,
    });
  },
});
