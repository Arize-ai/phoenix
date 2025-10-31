import { PhoenixClient } from "@arizeai/phoenix-client";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

const LIST_EXPERIMENTS_DESCRIPTION = `Get a list of all the experiments run on a given dataset.

Experiments are collections of experiment runs, each experiment run corresponds to a single 
dataset example. The dataset example is passed to an implied \`task\` which in turn 
produces an output.

Example usage:
  Show me all the experiments I've run on dataset RGF0YXNldDox

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

const GET_EXPERIMENT_DESCRIPTION = `Get an experiment by its ID.

The tool returns experiment metadata in the first content block and a JSON object with the 
experiment data in the second. The experiment data contains both the results of each 
experiment run and the annotations made by an evaluator to score or label the results, 
for example, comparing the output of an experiment run to the expected output from the 
dataset example.

Example usage:
  Show me the experiment results for experiment RXhwZXJpbWVudDo4

Expected return:
  Object containing experiment metadata and results.
  Example: {
    "metadata": {
      "id": "experimentid1234",
      "dataset_id": "datasetid1234",
      "dataset_version_id": "datasetversionid1234",
      "repetitions": 1,
      "metadata": {},
      "project_name": "Experiment-abc123",
      "created_at": "YYYY-MM-DDTHH:mm:ssZ",
      "updated_at": "YYYY-MM-DDTHH:mm:ssZ"
    },
    "experimentResult": [
      {
        "example_id": "exampleid1234",
        "repetition_number": 0,
        "input": "Sample input text",
        "reference_output": "Expected output text",
        "output": "Actual output text",
        "error": null,
        "latency_ms": 1000,
        "start_time": "2025-03-20T12:00:00Z",
        "end_time": "2025-03-20T12:00:01Z",
        "trace_id": "trace-123",
        "prompt_token_count": 10,
        "completion_token_count": 20,
        "annotations": [
          {
            "name": "quality",
            "annotator_kind": "HUMAN",
            "label": "good",
            "score": 0.9,
            "explanation": "Output matches expected format",
            "trace_id": "trace-456",
            "error": null,
            "metadata": {},
            "start_time": "YYYY-MM-DDTHH:mm:ssZ",
            "end_time": "YYYY-MM-DDTHH:mm:ssZ"
          }
        ]
      }
    ]
  }`;

export const initializeExperimentTools = ({
  client,
  server,
}: {
  client: PhoenixClient;
  server: McpServer;
}) => {
  server.tool(
    "list-experiments-for-dataset",
    LIST_EXPERIMENTS_DESCRIPTION,
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
    GET_EXPERIMENT_DESCRIPTION,
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
