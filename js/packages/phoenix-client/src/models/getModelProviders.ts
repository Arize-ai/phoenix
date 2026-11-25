import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import { LIST_MODEL_PROVIDERS } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import { ensureServerCapability } from "../utils/serverVersionUtils";

export type BuiltInModelProvider =
  components["schemas"]["BuiltInModelProvider"];

export type GetModelProvidersParams = ClientFn;

/**
 * List the built-in model providers enabled on the Phoenix server.
 *
 * @param params.client - Phoenix client to use. Defaults to a new client.
 *
 * @requires Phoenix server >= 20.4.0
 */
export async function getModelProviders(
  params: GetModelProvidersParams = {}
): Promise<BuiltInModelProvider[]> {
  const client = params.client || createClient();
  await ensureServerCapability({ client, requirement: LIST_MODEL_PROVIDERS });
  const response = await client.GET("/v1/model_providers");
  if (response.error) throw response.error;
  invariant(response.data?.data, "Failed to list model providers");
  return response.data.data;
}
