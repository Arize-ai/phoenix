import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import { LIST_DATASET_EVALUATORS } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { DatasetEvaluator, DatasetIdentifier } from "../types/evaluators";
import { resolveDatasetIdentifier } from "../types/evaluators";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for listing the evaluators bound to a dataset.
 */
export interface GetDatasetEvaluatorsParams extends ClientFn {
  /**
   * The dataset, by ID or name.
   */
  dataset: DatasetIdentifier;
  /**
   * Stop after this many bindings. Pagination is followed to the end by
   * default.
   */
  limit?: number;
}

type DatasetEvaluatorsPage =
  components["schemas"]["DatasetEvaluatorsResponseBody"];

const DEFAULT_PAGE_SIZE = 100;

/**
 * List every evaluator bound to a dataset, newest first. Pagination is
 * handled for you.
 *
 * @param params - The dataset to list bindings for.
 * @param params.dataset - The dataset, by `dataset` (name or ID), `datasetId`, or `datasetName`.
 * @param params.limit - Stop after this many bindings.
 * @param params.client - An optional Phoenix client instance.
 * @returns All bindings on the dataset.
 *
 * @requires Phoenix server >= 21.0.0
 *
 * @example
 * ```ts
 * import { getDatasetEvaluators } from "@arizeai/phoenix-client/evaluators";
 *
 * const bindings = await getDatasetEvaluators({
 *   dataset: { datasetName: "golden-questions" },
 * });
 * for (const binding of bindings) {
 *   console.log(binding.id, binding.name, binding.evaluator_type);
 * }
 * ```
 */
export async function getDatasetEvaluators({
  client: _client,
  dataset,
  limit,
}: GetDatasetEvaluatorsParams): Promise<DatasetEvaluator[]> {
  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: LIST_DATASET_EVALUATORS,
  });

  const datasetIdentifier = resolveDatasetIdentifier(dataset);
  const bindings: DatasetEvaluator[] = [];
  let cursor: string | null | undefined = null;

  do {
    const remaining =
      limit === undefined ? DEFAULT_PAGE_SIZE : limit - bindings.length;
    const response: { data?: DatasetEvaluatorsPage; error?: unknown } =
      await client.GET("/v1/datasets/{dataset_identifier}/evaluators", {
        params: {
          path: { dataset_identifier: datasetIdentifier },
          query: {
            cursor,
            limit: Math.max(1, Math.min(remaining, DEFAULT_PAGE_SIZE)),
          },
        },
      });

    if (response.error) throw response.error;
    invariant(response.data?.data, "Failed to list dataset evaluators");

    cursor = response.data.next_cursor ?? null;
    bindings.push(...response.data.data);
    if (limit !== undefined && bindings.length >= limit) {
      return bindings.slice(0, limit);
    }
  } while (cursor != null);

  return bindings;
}
