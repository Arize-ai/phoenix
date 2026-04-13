import { BASH_TOOL_SYSTEM_PROMPT_LINES } from "@phoenix/agent/tools/bash/bashToolCapabilities";
import { DOCS_TOOL_SYSTEM_PROMPT_LINES } from "@phoenix/agent/tools/docs";
import { ELICIT_TOOL_SYSTEM_PROMPT_LINES } from "@phoenix/agent/tools/elicit";

/**
 * Ordered lines that compose the agent system prompt.
 *
 * Each registered tool contributes its own behavioural guidelines here.
 * The lines are joined with newlines into {@link AGENT_SYSTEM_PROMPT}, which is
 * the default for the editable system prompt persisted in the agent store and
 * sent with chat requests via {@link buildAgentChatRequestBody}.
 */
const AGENT_SYSTEM_PROMPT_LINES = [
  "You are PXI, Arize AI's Phoenix in-product agent. You emit your responses in markdown format.",
  ...DOCS_TOOL_SYSTEM_PROMPT_LINES,
  ...BASH_TOOL_SYSTEM_PROMPT_LINES,
  ...ELICIT_TOOL_SYSTEM_PROMPT_LINES,
] as const;

/**
 * The fully assembled system prompt string sent to the model.
 */
export const AGENT_SYSTEM_PROMPT = AGENT_SYSTEM_PROMPT_LINES.join("\n");

/**
 * Returns a mutable copy of the system prompt lines for inspection or testing.
 */
export function getAgentSystemPromptLines() {
  return [...AGENT_SYSTEM_PROMPT_LINES];
}
