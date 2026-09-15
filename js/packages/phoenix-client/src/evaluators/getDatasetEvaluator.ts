import invariant from "tiny-invariant";

import { createClient } from "../client";
import { GET_DATASET_EVALUATOR } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { DatasetEvaluator } from "../types/evaluators";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for reading a dataset evaluator binding.
 */
export interface GetDatasetEvaluatorParams extends ClientFn {
  /**
   * The GlobalID of the binding.
   */
  datasetEvaluatorId: string;
}

/**
 * Read a dataset evaluator binding by ID.
 *
 * @param params - The binding to read.
 * @param params.datasetEvaluatorId - The binding GlobalID.
 * @param params.client - An optional Phoenix client instance.
 * @returns The binding. A null `description` or `output_configs` means the
 * binding inherits the shared definition's value.
 *
 * @requires Phoenix server >= 21.0.0
 */
export async function getDatasetEvaluator({
  client: _client,
  datasetEvaluatorId,
}: GetDatasetEvaluatorParams): Promise<DatasetEvaluator> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: GET_DATASET_EVALUATOR });

  const { data, error } = await client.GET(
    "/v1/dataset_evaluators/{dataset_evaluator_id}",
    { params: { path: { dataset_evaluator_id: datasetEvaluatorId } } }
  );

  if (error) throw error;
  invariant(data?.data, "Failed to get dataset evaluator");
  return data.data;
}
