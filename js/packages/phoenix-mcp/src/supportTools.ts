import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import z from "zod";

const PHOENIX_SUPPORT_DESCRIPTION = `Get help with Phoenix and OpenInference.

- Tracing AI applications via OpenInference and OpenTelemetry
- Phoenix datasets, experiments, and prompt management
- Phoenix evals and annotations

Use this tool when you need assistance with Phoenix features, troubleshooting,
or best practices.

Expected return:
  Expert guidance about how to use and integrate Phoenix`;

/**
 * Creates an MCP client connected to the RunLLM server via HTTP
 */
async function createRunLLMClient(): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(
    new URL("https://mcp.runllm.com/mcp/"),
    {
      requestInit: {
        headers: {
          "assistant-name": "arize-phoenix",
        },
      },
    }
  );

  const client = new Client({
    name: "runllm-client",
    version: "1.0.0",
  });

  await client.connect(transport);
  return client;
}

/**
 * Calls the chat tool on the RunLLM MCP server
 */
export async function callRunLLMQuery({
  query,
}: {
  query: string;
}): Promise<string> {
  const client = await createRunLLMClient();

  // Call the chat tool with the user's question
  const result = await client.callTool({
    name: "search",
    arguments: {
      query: query,
    },
  });

  // There's usually only one content item, but we'll handle multiple for safety
  if (result.content && Array.isArray(result.content)) {
    const textContent = result.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");

    if (textContent) {
      return textContent;
    }
  }

  return "No response received from support";
}

export const initializeSupportTools = async ({
  server,
}: {
  server: McpServer;
}) => {
  server.tool(
    "phoenix-support",
    PHOENIX_SUPPORT_DESCRIPTION,
    {
      query: z
        .string()
        .describe(
          "Your question about Arize Phoenix, OpenInference, or related topics"
        ),
    },
    async ({ query }) => {
      const result = await callRunLLMQuery({ query });
      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    }
  );
};
