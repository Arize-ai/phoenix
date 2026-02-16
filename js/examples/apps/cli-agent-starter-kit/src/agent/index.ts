import { anthropic } from "@ai-sdk/anthropic";
import { stepCountIs, Tool, ToolLoopAgent } from "ai";
import { AGENT_INSTRUCTIONS } from "../prompts/agent.js";

/**
 * Conversation history entry
 */
export type ConversationHistory = Array<{
  role: "user" | "assistant";
  content: string;
}>;

/**
 * Parameters for creating an agent
 */
export interface CreateAgentParams {
  /** Record of tool names to tool instances */
  tools: Record<string, Tool>;
  /** System instructions for the agent (default: AGENT_INSTRUCTIONS) */
  instructions?: string;
  /** Maximum number of steps before stopping (default: 10) */
  maxSteps?: number;
}

/**
 * Create a new agent instance with the provided tools
 *
 * @param params - Agent configuration parameters
 * @returns Configured ToolLoopAgent
 */
export function createAgent({
  tools,
  instructions = AGENT_INSTRUCTIONS,
  maxSteps = 10,
}: CreateAgentParams) {
  return new ToolLoopAgent({
    model: anthropic("claude-sonnet-4-20250514"),
    instructions,
    tools,
    stopWhen: stepCountIs(maxSteps),
    // Enable telemetry for Phoenix tracing
    experimental_telemetry: { isEnabled: true },
  });
}
