import { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { ExperimentRun } from "../types/experiments";

import invariant from "tiny-invariant";

export type GetExperimentRunsParams = ClientFn & {
  /**
   * The experiment ID.
   */
  experimentId: string;
  /**
   * The pagination size by which to pull runs
   * Exposed for controlling the rate at which runs are pulled
   * @default 100
   */
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 100;

/**
 * A function that gets all the runs (e.g. the results) of a experiment
 */
export async function getExperimentRuns({
  client: _client,
  experimentId,
  pageSize = DEFAULT_PAGE_SIZE,
}: GetExperimentRunsParams): Promise<{ runs: ExperimentRun[] }> {
  const client = _client || createClient();

  // Validate that the parameter is an integer and exit early
  invariant(
    Number.isInteger(pageSize) && pageSize > 0,
    "pageSize must be a positive integer greater than 0"
  );
  const runs: ExperimentRun[] = [];
  let cursor: string | null = null;
  do {
    const res: {
      data?: components["schemas"]["ListExperimentRunsResponseBody"];
    } = await client.GET("/v1/experiments/{experiment_id}/runs", {
      params: {
        path: {
          experiment_id: experimentId,
        },
        query: {
          cursor,
          limit: pageSize,
        },
      },
    });
    // NB: older versions of phoenix simply don't respond with a cursor and fetch all
    cursor = res.data?.next_cursor || null;
    const data = res.data?.data;
    invariant(data, "Failed to fetch runs");
    runs.push(
      ...data.map((run) => ({
        id: run.id,
        traceId: run.trace_id || null,
        experimentId: run.experiment_id,
        datasetExampleId: run.dataset_example_id,
        startTime: new Date(run.start_time),
        endTime: new Date(run.end_time),
        output: run.output as ExperimentRun["output"],
        error: run.error || null,
      }))
    );
  } while (cursor != null);

  return {
    runs,
  };
}
