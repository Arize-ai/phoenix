import { PhoenixClient } from "@arizeai/phoenix-client";
import { createPrompt, promptVersion } from "@arizeai/phoenix-client/prompts";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export const initializePrompts = async ({
  client,
  server,
}: {
  client: PhoenixClient;
  server: McpServer;
}) => {
  server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const promptsResponse = await client.GET("/v1/prompts");

    if (!promptsResponse.data) {
      return {
        prompts: [],
      };
    }

    // Get all the prompts and parse out the arguments
    const prompts = promptsResponse.data.data.map(async (prompt) => {
      const promptVersionResponse = await client.GET(
        "/v1/prompts/{prompt_identifier}/latest",
        {
          params: {
            path: {
              prompt_identifier: prompt.name,
            },
          },
        }
      );

      return {
        name: prompt.name,
        description: prompt.description,
        arguments: [],
      };
    });

    return prompts;
  });

  server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const arguments = request.params.arguments || {};
    // Get the latest version of the prompt
    const promptVersionResponse = await client.GET(
      "/v1/prompts/{prompt_identifier}/latest",
      {
        params: {
          path: {
            prompt_identifier: request.params.name,
          },
        },
      }
    );

    const template = promptVersionResponse.data?.data.template;
    let messages: { role: string; content: string }[] = [];
    if (template && template.type === "chat") {
      messages = template.messages.map((message) => {
        return {
          role: message.role as string,
          content: message.content as string,
        };
      });
    }
    return {
      description: promptVersionResponse.data?.data.description,
      messages: messages,
    };
  });
};
