import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import type { ClientFn } from "../types/core";

export type BuiltInModelProvider =
  components["schemas"]["BuiltInModelProvider"];

export type GetModelProvidersParams = ClientFn;

/**
 * List the built-in model providers enabled for the Phoenix deployment.
 *
 * The server filters this list according to its provider allow-list. Use the
 * returned providers instead of maintaining a hard-coded provider list in the
 * client application.
 *
 * @example
 * ```ts
 * import { getModelProviders } from "@arizeai/phoenix-client/modelProviders";
 *
 * const modelProviders = await getModelProviders();
 * for (const modelProvider of modelProviders) {
 *   console.log(`${modelProvider.name}: ${modelProvider.provider}`);
 * }
 * ```
 *
 * @param params - Client options.
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
