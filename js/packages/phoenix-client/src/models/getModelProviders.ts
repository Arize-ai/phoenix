import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import type { ClientFn } from "../types/core";

export type BuiltInModelProvider =
  components["schemas"]["BuiltInModelProvider"];

export type GetModelProvidersParams = ClientFn;

/**
 * List the built-in model providers enabled on the Phoenix server.
 *
 * @param params.client - Phoenix client to use. Defaults to a new client.
 */
export async function getModelProviders(
  params: GetModelProvidersParams = {}
): Promise<BuiltInModelProvider[]> {
  const client = params.client || createClient();
  const response = await client.GET("/v1/model_providers");
  invariant(response.data?.data, "Failed to list model providers");
  return response.data.data;
}
