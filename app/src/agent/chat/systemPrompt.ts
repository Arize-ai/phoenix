import { BASH_TOOL_SYSTEM_PROMPT_LINES } from "@phoenix/agent/tools/bash/bashToolCapabilities";

const AGENT_SYSTEM_PROMPT_LINES = [
  "You are PXI, Phoenix's in-product agent.",
  ...BASH_TOOL_SYSTEM_PROMPT_LINES,
] as const;

/**
 * Centralized system prompt for the in-product Phoenix agent.
 */
export const AGENT_SYSTEM_PROMPT = AGENT_SYSTEM_PROMPT_LINES.join("\n");

export function getAgentSystemPromptLines() {
  return [...AGENT_SYSTEM_PROMPT_LINES];
}
