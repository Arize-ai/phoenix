import { createMCPClient } from '@ai-sdk/mcp';
import type { Tool } from 'ai';

/**
 * MCP server configurations
 * Add or remove servers here to control which documentation sources are available
 */
const MCP_SERVERS = [
  {
    name: 'Phoenix Mintlify',
    url: 'https://arizeai-433a7140.mintlify.app/mcp',
    transport: 'http' as const,
  },
] as const;

/**
 * Load MCP documentation tools from configured servers
 * Returns a record of tool name -> tool definition
 */
export async function loadMCPTools(): Promise<Record<string, Tool>> {
  const allTools: Record<string, Tool> = {};

  for (const server of MCP_SERVERS) {
    try {
      console.log(`Loading ${server.name} tools...`);
      const client = await createMCPClient({
        transport: { type: server.transport, url: server.url },
      });
      const tools = await client.tools();
      Object.assign(allTools, tools);
      console.log(`✓ Loaded ${Object.keys(tools).length} tools from ${server.name}`);
    } catch (error) {
      console.warn(`✗ Failed to load ${server.name}:`, error instanceof Error ? error.message : String(error));
    }
  }

  return allTools;
}
