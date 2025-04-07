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
    "Get a list of all datasets.\n\n" +
    "Datasets are collections of 'dataset examples' that each example includes an input, " +
    "(expected) output, and optional metadata. They are primarily used as inputs for the experiments.",
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
  server.tool(
    "get-dataset-examples",
    "Get examples from a dataset.\n\n" +
    "Dataset examples are an array of objects that each include an input, " +
    "(expected) output, and optional metadata. These examples are typically used to represent " +
    "input to an application or model (e.g. prompt template variables, a code file, or image) " +
    "and used to test or benchmark changes.",
    {
      datasetId: z.string(),
    },
    async ({ datasetId }) => {
      const response = await client.GET("/v1/datasets/{id}/examples", {
        params: {
          path: { id: datasetId },
        },
      });
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
  server.tool(
    "get-dataset-experiments",
    "List experiments run on a dataset",
    {
      datasetId: z.string(),
    },
    async ({ datasetId }) => {
      const response = await client.GET(
        "/v1/datasets/{dataset_id}/experiments",
        {
          params: {
            path: { dataset_id: datasetId },
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
