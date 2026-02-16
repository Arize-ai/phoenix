import { anthropic } from "@ai-sdk/anthropic";
import { stepCountIs, Tool, ToolLoopAgent } from "ai";
import { DEFAULT_AGENT_INSTRUCTIONS } from "../prompts/agent.js";

/**
 * Conversation history entry
 */
export type ConversationHistory = Array<{
  role: "user" | "assistant";
  content: string;
}>;

/**
 * Agent configuration options
 */
export interface AgentConfig {
  /** System instructions for the agent (default: DEFAULT_AGENT_INSTRUCTIONS) */
  instructions?: string;
  /** Maximum number of steps before stopping (default: 10) */
  maxSteps?: number;
}

/**
 * Create a new agent instance with the provided tools
 *
 * @param tools - Record of tool names to tool instances
 * @param config - Optional configuration for the agent
 * @returns Configured ToolLoopAgent
 */
export function createAgent(
  tools: Record<string, Tool>,
  config: AgentConfig = {}
) {
  const {
    instructions = DEFAULT_AGENT_INSTRUCTIONS,
    maxSteps = 10,
  } = config;

  return new ToolLoopAgent({
    model: anthropic("claude-sonnet-4-20250514"),
    instructions,
    tools,
    stopWhen: stepCountIs(maxSteps),
    // Enable telemetry for Phoenix tracing
    experimental_telemetry: { isEnabled: true },
  });
}
