/**
 * CLI Agent Starter Kit - Programmatic API
 *
 * This module exports the core components for building CLI agents
 * with AI SDK and Phoenix tracing.
 */

// Agent components
export {
  createAgent,
  type ConversationHistory,
  type CreateAgentParams,
} from "./agent/index.js";
export { calculatorTool, getDateTimeTool } from "./agent/tools.js";

// Prompts
export { AGENT_INSTRUCTIONS } from "./prompts/agent.js";

// UI components
export { conversationLoop, processUserMessage } from "./ui/interaction.js";
export { printWelcome } from "./ui/welcome.js";

// Instrumentation
export { flush, SESSION_ID } from "./instrumentation.js";
