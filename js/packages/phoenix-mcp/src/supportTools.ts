import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import { RUNLLM_CONFIG, MCP_CONSTANTS } from "./constants.js";

const PHOENIX_SUPPORT_DESCRIPTION = `Get help and support for Arize Phoenix and AI observability questions.

This tool connects to Arize's specialized AI assistant that can answer questions about:
- Arize Phoenix observability platform
- LLM monitoring and evaluation
- AI model performance analysis
- Tracing and debugging AI applications
- Phoenix datasets, experiments, and prompt management
- Best practices for AI observability

Use this tool when you need expert assistance with Arize Phoenix features, troubleshooting,
or general AI observability guidance.

Example usage:
  - "How do I set up tracing for my LLM application?"
  - "What are the best practices for evaluating RAG systems?"
  - "How do I use Phoenix datasets for prompt engineering?"
  - "What metrics should I track for my AI model?"

Expected return:
  Expert guidance and information about Arize Phoenix and AI observability practices.`;

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: {
    tools?: Tool[];
    content?: ContentItem[];
    [key: string]: unknown;
  };
  error?: {
    code: number;
    message: string;
  };
}

interface Tool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface ContentItem {
  type: string;
  text?: string;
}

async function runLLMEndpoint(question: string): Promise<string> {
  const url = RUNLLM_CONFIG.ENDPOINT;
  const headers = RUNLLM_CONFIG.HEADERS;

  try {
    // Skip tool discovery for performance - we know 'chat' exists
    // ------------------------------------------------------------------
    // Call the 'chat' tool directly with the provided message
    // ------------------------------------------------------------------
    const callRequest: MCPRequest = {
      jsonrpc: MCP_CONSTANTS.JSONRPC_VERSION,
      id: 1,
      method: MCP_CONSTANTS.METHODS.TOOLS_CALL,
      params: {
        name: "chat",
        arguments: { message: question },
      },
    };

    const chatResponse = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(callRequest),
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    if (!chatResponse.ok) {
      throw new Error(`HTTP error! status: ${chatResponse.status}`);
    }

    const chatContentType = chatResponse.headers.get("content-type");

    if (chatContentType?.includes("text/event-stream")) {
      // Handle SSE stream for chat response with timeout
      if (!chatResponse.body) {
        throw new Error("No response body");
      }

      const reader = chatResponse.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedData = ""; // Accumulate data across chunks

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Try to parse any remaining accumulated data
            if (accumulatedData.length > 0) {
              try {
                const msg: MCPResponse = JSON.parse(accumulatedData);
                if (msg.id === 1 && msg.result && msg.result.content) {
                  const content = msg.result.content || [];
                  for (const item of content) {
                    if (item.type === "text" && item.text) {
                      try {
                        const parsedResponse = JSON.parse(item.text);
                        if (parsedResponse.response) {
                          return parsedResponse.response;
                        }
                      } catch (e) {
                        return item.text;
                      }
                    }
                  }
                }
              } catch (e) {
                // Could not parse final accumulated data
              }
            }

            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data:")) {
              const payload = line.slice(5).trim();

              // Check for [DONE] marker
              if (payload === "[DONE]") {
                break;
              }

              // Accumulate data instead of parsing each chunk individually
              accumulatedData += payload;

              // Try to parse the accumulated JSON
              try {
                const msg: MCPResponse = JSON.parse(accumulatedData);
                if (msg.id === 1 && msg.result) {
                  const texts: string[] = [];
                  const content = msg.result.content || [];

                  for (const item of content) {
                    if (item.type === "text" && item.text) {
                      // Parse the JSON response from runLLM
                      try {
                        const parsedResponse = JSON.parse(item.text);
                        if (parsedResponse.response) {
                          return parsedResponse.response;
                        }
                      } catch (e) {
                        // If not JSON, use raw text
                        texts.push(item.text);
                      }
                    }
                  }

                  if (texts.length > 0) {
                    return texts.join("\n");
                  }
                }

                // If we successfully parsed, reset accumulated data for next message
                accumulatedData = "";
              } catch (e) {
                // Continue accumulating - JSON is not yet complete
              }
            } else if (line.trim() === "") {
              // Empty line (heartbeat)
            } else if (accumulatedData.length > 0) {
              accumulatedData += line;

              // Try to parse the updated accumulated data
              try {
                const msg: MCPResponse = JSON.parse(accumulatedData);
                if (msg.id === 1 && msg.result) {
                  const texts: string[] = [];
                  const content = msg.result.content || [];

                  for (const item of content) {
                    if (item.type === "text" && item.text) {
                      // Parse the JSON response from runLLM
                      try {
                        const parsedResponse = JSON.parse(item.text);
                        if (parsedResponse.response) {
                          return parsedResponse.response;
                        }
                      } catch (e) {
                        // If not JSON, use raw text
                        texts.push(item.text);
                      }
                    }
                  }

                  if (texts.length > 0) {
                    return texts.join("\n");
                  }
                }

                // If we successfully parsed, reset accumulated data
                accumulatedData = "";
              } catch (e) {
                // Continue accumulating - JSON is still not yet complete
              }
            }
          }
        }
      } finally {
        // Clean up reader if needed
      }

      return "No response received from chat tool";
    } else {
      // Handle regular JSON response
      const data: MCPResponse = await chatResponse.json();
      if (data.result && data.result.content) {
        const texts: string[] = [];
        const content = data.result.content || [];

        for (const item of content) {
          if (item.type === "text" && item.text) {
            // Parse the JSON response from runLLM
            try {
              const parsedResponse = JSON.parse(item.text);
              if (parsedResponse.response) {
                return parsedResponse.response;
              }
            } catch (e) {
              // If not JSON, use raw text
              texts.push(item.text);
            }
          }
        }

        if (texts.length > 0) {
          return texts.join("\n");
        }
      } else {
        // No result or content in JSON response
      }
    }

    return "No response received from chat tool";
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error("Error testing runLLM endpoint:", errorMessage);
    return "An unexpected error occurred while testing the chat tool.";
  }
}

export const initializeSupportTools = ({ server }: { server: McpServer }) => {
  server.tool(
    "phoenix_support",
    PHOENIX_SUPPORT_DESCRIPTION,
    {
      question: z
        .string()
        .describe(
          "Your question about Arize Phoenix, AI observability, or related topics"
        ),
    },
    async ({ question }) => {
      const result = await runLLMEndpoint(question);
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
