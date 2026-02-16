import { anthropic } from "@ai-sdk/anthropic";
import { stepCountIs, Tool, ToolLoopAgent } from "ai";

/**
 * Conversation history entry
 */
export type ConversationHistory = Array<{
  role: "user" | "assistant";
  content: string;
}>;

/**
 * Create a new agent instance with the provided tools
 *
 * @param tools - Record of tool names to tool instances
 * @returns Configured ToolLoopAgent
 */
export function createAgent(tools: Record<string, Tool>) {
  return new ToolLoopAgent({
    model: anthropic("claude-sonnet-4-20250514"),
    instructions:
      "You are a helpful CLI agent. Use the available tools to answer questions accurately. Be concise and friendly.",
    tools,
    // Stop after 10 steps max
    stopWhen: stepCountIs(10),
    // Enable telemetry for Phoenix tracing
    experimental_telemetry: { isEnabled: true },
  });
}
