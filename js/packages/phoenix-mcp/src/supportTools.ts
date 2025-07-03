import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import z from "zod";

const PHOENIX_SUPPORT_DESCRIPTION = `Get help with Phoenix and OpenInference.

- Tracing AI apllications via OpenInference and OpenTelemetry
- Phoenix datasets, experiments, and prompt management
- Phoenix Evals and Annotations

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
export async function callRunLLMChat({
  question,
}: {
  question: string;
}): Promise<string> {
  const client = await createRunLLMClient();

  // Call the chat tool with the user's question
  const result = await client.callTool({
    name: "chat",
    arguments: {
      message: question,
    },
  });

  // Extract text content from the result
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
      question: z
        .string()
        .describe(
          "Your question about Arize Phoenix, OpenInference, or related topics"
        ),
    },
    async ({ question }) => {
      const result = await callRunLLMChat({ question });
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
