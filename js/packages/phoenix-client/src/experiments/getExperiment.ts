import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { ExperimentRunsMap, RanExperiment } from "../types/experiments";

import { getExperimentInfo } from "./getExperimentInfo";
import { getExperimentRuns } from "./getExperimentRuns";

export type GetExperimentResultParams = ClientFn & {
  /**
   * The experiment ID.
   */
  experimentId: string;
};

/**
 * A function that gets the result of a experiment.
 * Fetches the experiment data as well as the runs.
 */
export async function getExperiment({
  client: _client,
  experimentId,
}: GetExperimentResultParams): Promise<RanExperiment> {
  const client = _client || createClient();
  const [experiment, experimentRuns] = await Promise.all([
    getExperimentInfo({ client, experimentId }),
    getExperimentRuns({ client, experimentId }),
  ]);
  const experimentRunsMap: ExperimentRunsMap = {
    runs: experimentRuns.runs.reduce(
      (acc, run) => {
        acc[run.id] = run;
        return acc;
      },
      {} as ExperimentRunsMap["runs"]
    ),
  };
  return {
    ...experiment,
    ...experimentRunsMap,
  };
}
