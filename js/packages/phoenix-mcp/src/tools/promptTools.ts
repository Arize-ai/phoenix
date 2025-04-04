import { PhoenixClient } from "@arizeai/phoenix-client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

export const initializePromptTools = ({
  client,
  server,
}: {
  client: PhoenixClient;
  server: McpServer;
}) => {
  server.tool(
    "list-prompts",
    "Get a list of all the prompts",
    {
      limit: z.number().min(1).max(100).default(100),
    },
    async ({ limit }) => {
      const response = await client.GET("/v1/prompts", {
        params: {
          query: {
            limit,
          },
        },
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data?.data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get-latest-prompt",
    "Get the latest prompt",
    { prompt_identifier: z.string() },
    async ({ prompt_identifier }) => {
      const response = await client.GET(
        "/v1/prompts/{prompt_identifier}/latest",
        {
          params: {
            path: {
              prompt_identifier,
            },
          },
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    }
  );
};
