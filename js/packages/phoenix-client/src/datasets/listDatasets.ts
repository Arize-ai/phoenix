import { createClient } from "../client";
import { DatasetInfo } from "../types/datasets";
import { ClientFn } from "../types/core";
import invariant from "tiny-invariant";

export type ListDatasetsParams = ClientFn;

export type FullDatasetInfo = DatasetInfo & {
  startDate: Date;
  endDate: Date;
};

/**
 * List the information about all datasets available to the client.
 *
 * @example
 * ```ts
 * import { listDatasets } from "@arizeai/phoenix-client/datasets";
 *
 * const datasets = await listDatasets({});
 * console.log(datasets);
 * ```
 *
 * @throws {Error} If the datasets cannot be listed or the response is invalid.
 */
export async function listDatasets({
  client: _client,
}: ListDatasetsParams): Promise<FullDatasetInfo[]> {
  const client = _client || createClient();
  const response = await client.GET("/v1/datasets");
  invariant(response.data?.data, "Failed to list datasets");
  return response.data.data.map((dataset) => ({
    ...dataset,
    startDate: new Date(dataset.created_at),
    endDate: new Date(dataset.updated_at),
  }));
}
