import { PhoenixClient } from "@arizeai/phoenix-client";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

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
  Object containing dataset ID, version ID, and array of examples.
  Example: {
    "dataset_id": "datasetid1234",
    "version_id": "datasetversionid1234",
    "examples": [
      {
        "id": "exampleid1234",
        "input": {
          "text": "Sample input text"
        },
        "output": {
          "text": "Expected output text"
        },
        "metadata": {},
        "updated_at": "YYYY-MM-DDTHH:mm:ssZ"
      }
    ]
  }`;

const GET_DATASET_EXPERIMENTS_DESCRIPTION = `List experiments run on a dataset.

Example usage:
  Show me all experiments run on dataset RGF0YXNldDox

Expected return:
  Array of experiment objects with metadata.
  Example: [
    {
      "id": "experimentid1234",
      "dataset_id": "datasetid1234",
      "dataset_version_id": "datasetversionid1234",
      "repetitions": 1,
      "metadata": {},
      "project_name": "Experiment-abc123",
      "created_at": "YYYY-MM-DDTHH:mm:ssZ",
      "updated_at": "YYYY-MM-DDTHH:mm:ssZ"
    }
  ]`;

const ADD_DATASET_EXAMPLES_DESCRIPTION = `Add examples to an existing dataset.

This tool adds one or more examples to an existing dataset. Each example includes an input,
output, and metadata. The metadata will automatically include information indicating that
these examples were synthetically generated via MCP. When calling this tool, check existing
examples using the "get-dataset-examples" tool to ensure that you are not adding duplicate
examples and following existing patterns for how data should be structured.

Example usage:
  Look at the analyze "my-dataset" and augment them with new examples to cover relevant edge cases

Expected return:
  Confirmation of successful addition of examples to the dataset.
  Example: {
    "dataset_name": "my-dataset",
    "message": "Successfully added examples to dataset"
  }`;

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
    GET_DATASET_EXAMPLES_DESCRIPTION,
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
    GET_DATASET_EXPERIMENTS_DESCRIPTION,
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
  server.tool(
    "add-dataset-examples",
    ADD_DATASET_EXAMPLES_DESCRIPTION,
    {
      datasetName: z.string(),
      examples: z.array(
        z.object({
          input: z.record(z.any()),
          output: z.record(z.any()),
          metadata: z.record(z.any()).optional(),
        })
      ),
    },
    async ({ datasetName, examples }) => {
      // Add MCP metadata to each example
      const examplesWithMetadata = examples.map((example) => ({
        ...example,
        metadata: {
          ...example.metadata,
          source: "Synthetic Example added via MCP",
        },
      }));

      const response = await client.POST("/v1/datasets/upload", {
        body: {
          action: "append",
          name: datasetName,
          inputs: examplesWithMetadata.map((e) => e.input),
          outputs: examplesWithMetadata.map((e) => e.output),
          metadata: examplesWithMetadata.map((e) => e.metadata),
        },
        params: {
          query: {
            sync: true,
          },
        },
      });

      if (!response.data?.data?.dataset_id) {
        throw new Error(
          "Failed to add examples to dataset: No dataset ID received"
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                dataset_name: datasetName,
                dataset_id: response.data.data.dataset_id,
                message: "Successfully added examples to dataset",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
};
