import { createMCPClient } from '@ai-sdk/mcp';
import type { MCPClient } from '@ai-sdk/mcp';
import type { Tool } from 'ai';

let phoenixMintlifyClient: MCPClient | null = null;
let arizeAXClient: MCPClient | null = null;
let runLLMPhoenixClient: MCPClient | null = null;

export async function initializeMCPClients(): Promise<void> {
  try {
    phoenixMintlifyClient = await createMCPClient({
      transport: { type: 'http', url: 'https://arizeai-433a7140.mintlify.app/mcp' },
    });
  } catch (error) {
    console.warn('Failed to initialize Phoenix Mintlify MCP client:', error);
  }

  try {
    arizeAXClient = await createMCPClient({
      transport: { type: 'sse', url: 'https://arize-ax.mintlify.dev/mcp' },
    });
  } catch (error) {
    console.warn('Failed to initialize Arize-AX MCP client:', error);
  }

  try {
    runLLMPhoenixClient = await createMCPClient({
      transport: { type: 'http', url: 'https://mcp.runllm.com/mcp' },
    });
  } catch (error) {
    console.warn('Failed to initialize RunLLM Phoenix MCP client:', error);
  }
}

export async function getMCPTools(): Promise<Record<string, Tool>> {
  const tools: Record<string, Tool> = {};

  if (phoenixMintlifyClient) {
    try {
      Object.assign(tools, await phoenixMintlifyClient.tools());
    } catch (error) {
      console.warn('Failed to load Phoenix Mintlify tools:', error);
    }
  }

  if (arizeAXClient) {
    try {
      Object.assign(tools, await arizeAXClient.tools());
    } catch (error) {
      console.warn('Failed to load Arize-AX tools:', error);
    }
  }

  if (runLLMPhoenixClient) {
    try {
      Object.assign(tools, await runLLMPhoenixClient.tools());
    } catch (error) {
      console.warn('Failed to load RunLLM Phoenix tools:', error);
    }
  }

  return tools;
}

export async function cleanupMCPClients(): Promise<void> {
  await Promise.all([
    phoenixMintlifyClient?.close().catch(console.error),
    arizeAXClient?.close().catch(console.error),
    runLLMPhoenixClient?.close().catch(console.error),
  ].filter(Boolean));
}
