import { createMCPClient } from "@ai-sdk/mcp";
import type { Tool } from "ai";

/**
 * Phoenix Documentation MCP Tool
 *
 * Provides real-time access to Phoenix documentation via Model Context Protocol (MCP).
 * Connects to the Phoenix Mintlify documentation server to search and retrieve
 * up-to-date information about Phoenix features, APIs, and usage patterns.
 *
 * @see https://arizeai-433a7140.mintlify.app/mcp
 */
const phoenixMCPClient = await createMCPClient({
  transport: {
    type: "http",
    url: "https://arizeai-433a7140.mintlify.app/mcp",
  },
});

const phoenixMCPTools = await phoenixMCPClient.tools();

/**
 * Phoenix documentation search tool
 * Searches Phoenix documentation and returns relevant results.
 *
 * The Mintlify MCP server exposes this as `search_phoenix`; fall back to the
 * first available tool so a server-side rename degrades gracefully instead of
 * handing the agent an `undefined` tool.
 */
export const phoenixDocsTool: Tool =
  phoenixMCPTools.search_phoenix ?? Object.values(phoenixMCPTools)[0];
