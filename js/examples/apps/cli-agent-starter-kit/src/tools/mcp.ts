import { createMCPClient } from '@ai-sdk/mcp';
import type { Tool } from 'ai';

/**
 * Phoenix documentation MCP tool
 * Provides access to Phoenix documentation via Mintlify MCP server
 */
const phoenixMCPClient = await createMCPClient({
  transport: {
    type: 'http',
    url: 'https://arizeai-433a7140.mintlify.app/mcp',
  },
});

const phoenixMCPTools = await phoenixMCPClient.tools();

/**
 * Phoenix documentation MCP tool for searching docs
 */
export const phoenixDocsMCPTool: Tool = phoenixMCPTools.search_docs;
