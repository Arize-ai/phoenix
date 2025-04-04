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

  server.tool(
    "get-experiment-by-id",
    "Get an experiment by its ID. The tool returns experiment metadata in the first content block and a JSON object with the experiment data in the second.",
    {
      experiment_id: z.string(),
    },
    async ({ experiment_id }) => {
      const [experimentMetadataResponse, experimentDataResponse] =
        await Promise.all([
          client.GET("/v1/experiments/{experiment_id}", {
            params: {
              path: {
                experiment_id,
              },
            },
          }),
          client.GET("/v1/experiments/{experiment_id}/json", {
            params: {
              path: {
                experiment_id,
              },
            },
          }),
        ]);
      const text = JSON.stringify({
        metadata: experimentMetadataResponse.data?.data,
        experimentResult: experimentDataResponse.data,
      });
      return {
        content: [{ type: "text", text }],
      };
    }
  );
};
