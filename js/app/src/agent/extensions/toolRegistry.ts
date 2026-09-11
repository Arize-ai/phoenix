/**
 * Frontend registry for executing PXI tools whose model-facing definitions are
 * advertised by the server.
 *
 * This module is an aggregator: each tool defines itself in its own module
 * under `@phoenix/agent/tools/*` using the `defineTool` helper, and this file
 * assembles them into the ordered registry and exposes the dispatch +
 * UI-behavior surface to the chat layer.
 *
 * Browser UI-state operations (time range, spans filter, playground prompts,
 * evaluator drafts, dataset/annotation writes, …) are no longer individual
 * tools: they live in the UI-operation catalog
 * (`@phoenix/agent/uiOperations`) and execute through the `search_browser_actions` /
 * `execute_browser_action` meta-tools registered below. The dataset read tools are
 * retired too — reads go through the server-side `bash` tool's `phoenix-gql`.
 */
import { askUserAgentTool } from "@phoenix/agent/tools/elicit";
import { getRouteInfoAgentTool } from "@phoenix/agent/tools/getRouteInfo";
import { renderGenerativeUIAgentTool } from "@phoenix/agent/tools/renderGenerativeUI";
import { executeBrowserActionTool } from "@phoenix/agent/uiOperations/executeBrowserActionTool";
import { searchBrowserActionsTool } from "@phoenix/agent/uiOperations/searchBrowserActionsTool";

import type { AgentToolDefinition } from "./registry/defineTool";
import { createAgentToolDispatcher } from "./registry/dispatch";

export type { AgentToolCall, AgentToolUIBehavior } from "./registry/defineTool";

/**
 * The two meta-tools fronting the UI-operation catalog: `search_browser_actions`
 * discovers operations and their signatures; `execute_browser_action` runs an
 * agent-authored script against them in a sandboxed worker.
 */
const UIOperationTools: AgentToolDefinition[] = [
  searchBrowserActionsTool,
  executeBrowserActionTool,
];

/**
 * The remaining tools own what they do (built with the lower-level
 * `defineTool`):
 * - `get_route_info` resolves route info from the catalog and returns it directly;
 * - `render_generative_ui` synchronously acknowledges an out-of-band chart render;
 * - `ask_user` writes a pending-approval store entry and defers its output to
 *   a later accept/reject.
 */
const tools: AgentToolDefinition[] = [
  getRouteInfoAgentTool,
  renderGenerativeUIAgentTool,
  askUserAgentTool,
];

/** Ordered registry of all frontend-executable tools. */
const agentToolDefinitions: AgentToolDefinition[] = [
  ...UIOperationTools,
  ...tools,
];

const dispatcher = createAgentToolDispatcher(agentToolDefinitions);

/**
 * Validates and dispatches one tool call from the AI SDK runtime to the
 * matching frontend tool implementation.
 */
export const handleRegisteredAgentToolCall =
  dispatcher.handleRegisteredAgentToolCall;

/** Returns the UI surfacing hints declared by a tool, if any. */
export const getAgentToolUIBehavior = dispatcher.getAgentToolUIBehavior;

/**
 * Whether a tool declared `rehydratable`, so an unresolved call can be
 * re-dispatched on session load. False for unregistered tools.
 */
export const isRehydratableAgentTool = dispatcher.isRehydratableAgentTool;
