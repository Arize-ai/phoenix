import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";
import { GENERATIVE_UI_TOOL_NAME } from "@phoenix/components/agent/generativeUICatalog";

import {
  getRenderGenerativeUIInvalidInputErrorText,
  parseRenderGenerativeUIInput,
} from "./parsers";
import type { RenderGenerativeUIInput } from "./types";

/**
 * The generative UI render is acknowledged synchronously; the chart itself is
 * streamed as a json-render data part handled elsewhere in the chat UI.
 */
export const renderGenerativeUIAgentTool = defineTool<RenderGenerativeUIInput>({
  name: GENERATIVE_UI_TOOL_NAME,
  parseInput: parseRenderGenerativeUIInput,
  invalidInputErrorText: getRenderGenerativeUIInvalidInputErrorText,
  execute: async ({ toolCall, addToolOutput }) => {
    await addToolOutput({
      state: "output-available",
      tool: GENERATIVE_UI_TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      output: "Generative UI rendered in chat.",
    });
  },
});
