/**
 * CLI Agent Starter Kit - Programmatic API
 *
 * This module exports core components for building agents with AI SDK.
 * Note: This does NOT include CLI-specific UI components or Phoenix instrumentation.
 * Those are designed for the CLI entry point and have global side effects.
 */

// Agent components
export {
  createAgent,
  type ConversationHistory,
  type CreateAgentParams,
} from "./agent/index.js";
export { getDateTimeTool } from "./agent/tools.js";
export { phoenixDocsMCPTool } from "./tools/mcp.js";

// Prompts
export { AGENT_INSTRUCTIONS } from "./prompts/agent.js";
