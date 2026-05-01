/** Default user-editable PXI instruction section. */
export const AGENT_SYSTEM_PROMPT: string = "";

/** Returns a mutable copy of the default custom instruction lines. */
export function getAgentSystemPromptLines() {
  return AGENT_SYSTEM_PROMPT ? AGENT_SYSTEM_PROMPT.split("\n") : [];
}
