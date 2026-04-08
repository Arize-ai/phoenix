/**
 * For the workflow to add, edit, or remove a frontend tool, see
 * `.agents/skills/phoenix-pxi/rules/extending-frontend-tool-registry.md`.
 */
import { agentToolDefinitions } from "@phoenix/agent/extensions/toolRegistry";

/**
 * Client-side tool definitions sent alongside every chat request so the
 * server knows which tools the frontend can execute locally.
 *
 * To add a new tool, import its definition from the relevant tool module
 * and append it to this array. The corresponding handler must also be
 * registered in {@link handleAgentToolCall}.
 */
export { agentToolDefinitions };
