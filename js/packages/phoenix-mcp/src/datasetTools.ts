import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

import { MAX_LIST_LIMIT, MCP_SYNTHETIC_SOURCE } from "./constants.js";
import { resolveDatasetId } from "./datasetUtils.js";
import { fetchAllPages } from "./pagination.js";
import { getResponseData } from "./responseUtils.js";
import { jsonResponse } from "./toolResults.js";

// ---------------------------------------------------------------------------
// Tool descriptions
// ---------------------------------------------------------------------------

const LIST_DATASETS_DESCRIPTION = `Get a list of all datasets.

Datasets are collections of 'dataset examples' that each example includes an input,
(expected) output, and optional metadata. They are primarily used as inputs for experiments.

Example usage:
  Show me all available datasets

Expected return:
  Array of dataset objects with metadata.
  Example: [
    {
      "id": "RGF0YXNldDox",
      "name": "my-dataset",
      "description": "A dataset for testing",
      "metadata": {},
      "created_at": "2024-03-20T12:00:00Z",
      "updated_at": "2024-03-20T12:00:00Z"
    }
  ]`;

const GET_DATASET_EXAMPLES_DESCRIPTION = `Get examples from a dataset.

Dataset examples are an array of objects that each include an input,
(expected) output, and optional metadata. These examples are typically used to represent
input to an application or model (e.g. prompt template variables, a code file, or image)
and used to test or benchmark changes.

Example usage:
  Show me all examples from dataset RGF0YXNldDox

Expected return:
  Object containing dataset ID, version ID, and array of examples.`;

const GET_DATASET_EXPERIMENTS_DESCRIPTION = `List experiments run on a dataset.

Example usage:
  Show me all experiments run on dataset RGF0YXNldDox

Expected return:
  Array of experiment objects with metadata.`;

const ADD_DATASET_EXAMPLES_DESCRIPTION = `Add examples to an existing dataset.

This tool adds one or more examples to an existing dataset. Each example includes an input,
output, and metadata. The metadata will automatically include information indicating that
these examples were synthetically generated via MCP. When calling this tool, check existing
examples using the "get-dataset-examples" tool to ensure that you are not adding duplicate
examples and following existing patterns for how data should be structured.

Example usage:
  Look at the analyze "my-dataset" and augment them with new examples to cover relevant edge cases

Expected return:
  Confirmation of successful addition of examples to the dataset.`;

const GET_DATASET_DESCRIPTION = `Get dataset metadata by name or ID.

Example usage:
  Show me the dataset "my-dataset"

Expected return:
  A dataset object with metadata and version information.`;

// ---------------------------------------------------------------------------
// Shared schema
// ---------------------------------------------------------------------------

const datasetSelectorSchema = z
  .object({
    dataset_id: z.string().optional(),
    dataset_name: z.string().optional(),
  })
  .refine(
    ({ dataset_id, dataset_name }) => Boolean(dataset_id || dataset_name),
    { message: "Provide dataset_id or dataset_name" }
  );

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register dataset-related MCP tools on the given server.
 */
export const initializeDatasetTools = ({
  client,
  server,
}: {
  client: PhoenixClient;
  server: McpServer;
}) => {
  server.tool(
    "list-datasets",
    LIST_DATASETS_DESCRIPTION,
    {
      limit: z.number().min(1).max(MAX_LIST_LIMIT).default(100),
    },
    async ({ limit }) => {
      const datasets = await fetchAllPages({
        limit,
        fetchPage: async (cursor, pageSize) => {
          const response = await client.GET("/v1/datasets", {
            params: { query: { cursor, limit: pageSize } },
          });
          const data = getResponseData({
            response,
            errorPrefix: "Failed to fetch datasets",
          });
          return { data: data.data, nextCursor: data.next_cursor || undefined };
        },
      });

      return jsonResponse(datasets);
    }
  );

  server.tool(
    "get-dataset",
    GET_DATASET_DESCRIPTION,
    datasetSelectorSchema.shape,
    async ({ dataset_id, dataset_name }) => {
      const resolvedId = await resolveDatasetId({
        client,
        datasetId: dataset_id,
        datasetName: dataset_name,
      });

      const response = await client.GET("/v1/datasets/{id}", {
        params: { path: { id: resolvedId } },
      });
      const dataset = getResponseData({
        response,
        errorPrefix: `Failed to fetch dataset "${resolvedId}"`,
      }).data;

      return jsonResponse(dataset);
    }
  );

  server.tool(
    "get-dataset-examples",
    GET_DATASET_EXAMPLES_DESCRIPTION,
    {
      ...datasetSelectorSchema.shape,
      version_id: z.string().optional(),
      splits: z.array(z.string()).optional(),
    },
    async ({ dataset_id, dataset_name, version_id, splits }) => {
      const resolvedId = await resolveDatasetId({
        client,
        datasetId: dataset_id,
        datasetName: dataset_name,
      });

      const response = await client.GET("/v1/datasets/{id}/examples", {
        params: {
          path: { id: resolvedId },
          query: { version_id, split: splits },
        },
      });
      const datasetExamples = getResponseData({
        response,
        errorPrefix: `Failed to fetch examples for dataset "${resolvedId}"`,
      });

      return jsonResponse(datasetExamples);
    }
  );

  server.tool(
    "get-dataset-experiments",
    GET_DATASET_EXPERIMENTS_DESCRIPTION,
    {
      ...datasetSelectorSchema.shape,
      limit: z.number().min(1).max(MAX_LIST_LIMIT).default(100).optional(),
    },
    async ({ dataset_id, dataset_name, limit = 100 }) => {
      const resolvedId = await resolveDatasetId({
        client,
        datasetId: dataset_id,
        datasetName: dataset_name,
      });

      const experiments = await fetchAllPages({
        limit,
        fetchPage: async (cursor, pageSize) => {
          const response = await client.GET(
            "/v1/datasets/{dataset_id}/experiments",
            {
              params: {
                path: { dataset_id: resolvedId },
                query: { cursor, limit: pageSize },
              },
            }
          );
          const data = getResponseData({
            response,
            errorPrefix: `Failed to fetch experiments for dataset "${resolvedId}"`,
          });
          return { data: data.data, nextCursor: data.next_cursor || undefined };
        },
      });

      return jsonResponse(experiments);
    }
  );

  server.tool(
    "add-dataset-examples",
    ADD_DATASET_EXAMPLES_DESCRIPTION,
    {
      dataset_name: z.string(),
      examples: z.array(
        z.object({
          input: z.record(z.string(), z.unknown()),
          output: z.record(z.string(), z.unknown()),
          metadata: z.record(z.string(), z.unknown()).optional(),
        })
      ),
    },
    async ({ dataset_name, examples }) => {
      const examplesWithMetadata = examples.map((example) => ({
        ...example,
        metadata: {
          ...example.metadata,
          source: MCP_SYNTHETIC_SOURCE,
        },
      }));

      const response = await client.POST("/v1/datasets/upload", {
        body: {
          action: "append",
          name: dataset_name,
          inputs: examplesWithMetadata.map((e) => e.input),
          outputs: examplesWithMetadata.map((e) => e.output),
          metadata: examplesWithMetadata.map((e) => e.metadata),
        },
        params: { query: { sync: true } },
      });

      const uploadResponse = getResponseData({
        response,
        errorPrefix: `Failed to add examples to dataset "${dataset_name}"`,
      });
      const uploadData = uploadResponse?.data;

      if (!uploadData?.dataset_id) {
        throw new Error(
          "Failed to add examples to dataset: No dataset ID received"
        );
      }

      return jsonResponse({
        dataset_name,
        dataset_id: uploadData.dataset_id,
        message: "Successfully added examples to dataset",
      });
    }
  );
};
