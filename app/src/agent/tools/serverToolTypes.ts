import { DOCS_TOOL_NAMES } from "@phoenix/agent/tools/docs";

/**
 * Server-executed tools are model-facing tools that the frontend may render,
 * but must not dispatch through the browser-owned tool registry.
 */
export const SERVER_EXECUTED_AGENT_TOOL_NAMES = [...DOCS_TOOL_NAMES] as const;

export type ServerExecutedAgentToolName =
  (typeof SERVER_EXECUTED_AGENT_TOOL_NAMES)[number];

export function isServerExecutedAgentToolName(
  name: string
): name is ServerExecutedAgentToolName {
  return (SERVER_EXECUTED_AGENT_TOOL_NAMES as readonly string[]).includes(name);
}
