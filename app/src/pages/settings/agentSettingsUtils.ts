/**
 * Whether the subagents (server-side bash tool) setting should be offered in the
 * UI. Hidden when the deployment sets PHOENIX_AGENTS_DISABLE_BASH, which prevents
 * subagents from being attached server-side. Does not affect the frontend bash tool.
 */
export function shouldShowSubagentsSetting(
  agentsBashDisabled: boolean
): boolean {
  return !agentsBashDisabled;
}
