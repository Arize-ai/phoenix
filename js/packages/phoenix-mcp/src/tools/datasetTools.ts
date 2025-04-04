import { PhoenixClient } from "@arizeai/phoenix-client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

export const initializeDatasetTools = ({
  client,
  server,
}: {
  client: PhoenixClient;
  server: McpServer;
}) => {
  server.tool(
    "list-datasets",
    "Get a list of all the datasets",
    {
      limit: z.number().min(1).max(100).default(100),
    },
    async ({ limit }) => {
      const response = await client.GET("/v1/datasets", {
        params: {
          query: { limit },
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
};
