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
 * Searches Phoenix documentation and returns relevant results
 */
export const phoenixDocsTool: Tool = phoenixMCPTools.SearchPhoenix;
