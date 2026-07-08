import { anthropic } from "@ai-sdk/anthropic";
import { stepCountIs, ToolLoopAgent } from "ai";

import { AGENT_INSTRUCTIONS } from "../prompts/agent.js";
import { dateTimeTool, phoenixDocsTool } from "../tools/index.js";

/**
 * Default agent instance with Phoenix documentation tools
 */
export const agent = new ToolLoopAgent({
  model: anthropic("claude-haiku-4-5-20251001"),
  instructions: AGENT_INSTRUCTIONS,
  tools: {
    dateTime: dateTimeTool,
    phoenixDocs: phoenixDocsTool,
  },
  stopWhen: stepCountIs(10),
  // Enable telemetry for Phoenix tracing
  experimental_telemetry: { isEnabled: true },
});

export type Agent = typeof agent;
