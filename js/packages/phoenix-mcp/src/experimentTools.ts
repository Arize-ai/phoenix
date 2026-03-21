import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

import { getResponseData, resolveDatasetId } from "./client.js";
import { jsonResponse } from "./toolResults.js";

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
      datasetIdentifier: z.string().optional(),
      dataset_id: z.string().optional(),
      limit: z.number().min(1).max(500).default(100).optional(),
    },
    async ({ datasetIdentifier, dataset_id, limit = 100 }) => {
      if (!datasetIdentifier && !dataset_id) {
        throw new Error("datasetIdentifier or legacy dataset_id is required");
      }

      const resolvedDatasetId = await resolveDatasetId({
        client,
        datasetIdentifier: datasetIdentifier || dataset_id || "",
      });
      const experiments: unknown[] = [];
      let cursor: string | undefined;

      do {
        const pageLimit = Math.min(limit - experiments.length, 100);
        const response = await client.GET(
          "/v1/datasets/{dataset_id}/experiments",
          {
            params: {
              path: {
                dataset_id: resolvedDatasetId,
              },
              query: {
                cursor,
                limit: pageLimit,
              },
            },
          }
        );
        const data = getResponseData({
          response,
          errorPrefix: `Failed to fetch experiments for dataset "${resolvedDatasetId}"`,
        });

        experiments.push(...data.data);
        cursor = data.next_cursor || undefined;
      } while (cursor && experiments.length < limit);

      return jsonResponse(experiments.slice(0, limit));
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
      const metadata = getResponseData({
        response: experimentMetadataResponse,
        errorPrefix: `Failed to fetch experiment "${experiment_id}" metadata`,
      });
      const experimentResult = getResponseData({
        response: experimentDataResponse,
        errorPrefix: `Failed to fetch experiment "${experiment_id}" JSON`,
      });

      return jsonResponse({
        metadata: metadata.data,
        experimentResult,
      });
    }
  );
};
