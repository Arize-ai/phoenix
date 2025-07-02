/**
 * Configuration constants for external service integrations
 */

export const RUNLLM_CONFIG = {
  ENDPOINT: "https://mcp.runllm.com/mcp/",
  ASSISTANT_NAME: "arize-phoenix",
  HEADERS: {
    "assistant-name": "arize-phoenix",
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  },
} as const;

/**
 * MCP protocol constants
 */
export const MCP_CONSTANTS = {
  JSONRPC_VERSION: "2.0",
  METHODS: {
    TOOLS_LIST: "tools/list",
    TOOLS_CALL: "tools/call",
  },
} as const;
