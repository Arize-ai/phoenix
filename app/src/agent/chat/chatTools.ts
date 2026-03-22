import { bashToolDefinition } from "@phoenix/agent/tools/bash";

/**
 * Client-side tool definitions sent alongside every chat request so the
 * server knows which tools the frontend can execute locally.
 *
 * To add a new tool, import its definition from the relevant tool module
 * and append it to this array. The corresponding handler must also be
 * registered in {@link handleAgentToolCall}.
 */
export const agentToolDefinitions = [bashToolDefinition];
