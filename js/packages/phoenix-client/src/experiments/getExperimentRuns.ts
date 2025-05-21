import { createClient } from "../client";
import invariant from "tiny-invariant";
import { ClientFn } from "../types/core";
import { ExperimentRun } from "../types/experiments";

export type GetExperimentRunsParams = ClientFn & {
  /**
   * The experiment ID.
   */
  experimentId: string;
};

/**
 * A function that gets the runs (e.g. the results) of a experiment
 */
export async function getExperimentRuns({
  client: _client,
  experimentId,
}: GetExperimentRunsParams): Promise<{ runs: ExperimentRun[] }> {
  const client = _client || createClient();
  const getRunsPromise = client.GET("/v1/experiments/{experiment_id}/runs", {
    params: {
      path: {
        experiment_id: experimentId,
      },
    },
  });
  const [experimentRunResponse] = await Promise.all([getRunsPromise]);
  const { data: { data: experimentRunsData } = {} } = experimentRunResponse;
  invariant(experimentRunsData, "Failed to retrieve experiment runs");
  return {
    runs: experimentRunsData.map((run) => {
      return {
        id: run.id,
        traceId: run.trace_id || null,
        experimentId: run.experiment_id,
        datasetExampleId: run.dataset_example_id,
        startTime: new Date(run.start_time),
        endTime: new Date(run.end_time),
        output: run.output as ExperimentRun["output"],
        error: run.error || null,
      };
    }),
  };
}
