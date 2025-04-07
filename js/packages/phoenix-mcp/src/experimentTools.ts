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
    "Get a list of all the experiments run on a given dataset.\n\n" +
    "Experiments are collections of experiment runs, each experiment run corresponds to a single " +
    "dataset example. The dataset example is passed to an implied `task` which in turn " +
    "produces an output.",
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
    "Get an experiment by its ID.\n\n" +
    "The tool returns experiment metadata in the first content block and a JSON object with the " +
    "experiment data in the second. The experiment data contains both the results of each " +
    "experiment run and the annotations made by an evaluator to score or label the results, " +
    "for example, comparing the output of an experiment run to the expected output from the " +
    "dataset example.",
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
