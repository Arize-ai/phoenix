import { PhoenixClient } from "@arizeai/phoenix-client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

export const initializeExperimentTools = ({
  client,
  server,
}: {
  client: PhoenixClient;
  server: McpServer;
}) => {
  server.tool(
    "list-experiments-for-dataset",
    "Get a list of all the experiments for a given dataset",
    {
      dataset_id: z.string(),
    },
    async ({ dataset_id }) => {
      const response = await client.GET(
        "/v1/datasets/{dataset_id}/experiments",
        {
          params: {
            path: {
              dataset_id,
            },
          },
        }
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(response.data?.data, null, 2) },
        ],
      };
    }
  );
};
