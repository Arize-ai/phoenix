import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

import { MAX_LIST_LIMIT } from "./constants.js";
import { resolveDatasetId } from "./datasetUtils.js";
import { fetchAllPages } from "./pagination.js";
import { getResponseData } from "./responseUtils.js";
import { jsonResponse } from "./toolResults.js";

// ---------------------------------------------------------------------------
// Tool descriptions
// ---------------------------------------------------------------------------

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
  Object containing experiment metadata and results.`;

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register experiment-related MCP tools on the given server.
 */
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
      dataset_id: z.string().optional(),
      dataset_name: z.string().optional(),
      limit: z.number().min(1).max(MAX_LIST_LIMIT).default(100).optional(),
    },
    async ({ dataset_id, dataset_name, limit = 100 }) => {
      const resolvedDatasetId = await resolveDatasetId({
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
                path: { dataset_id: resolvedDatasetId },
                query: { cursor, limit: pageSize },
              },
            }
          );
          const data = getResponseData({
            response,
            errorPrefix: `Failed to fetch experiments for dataset "${resolvedDatasetId}"`,
          });
          return { data: data.data, nextCursor: data.next_cursor || undefined };
        },
      });

      return jsonResponse(experiments);
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
            params: { path: { experiment_id } },
          }),
          client.GET("/v1/experiments/{experiment_id}/json", {
            params: { path: { experiment_id } },
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
