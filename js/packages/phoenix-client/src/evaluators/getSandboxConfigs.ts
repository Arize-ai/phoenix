import { createClient } from "../client";
import { LIST_SANDBOX_CONFIGS } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { SandboxConfig } from "../types/evaluators";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for listing sandbox configurations.
 */
export interface GetSandboxConfigsParams extends ClientFn {
  /**
   * Return configurations for this language only.
   */
  language?: SandboxConfig["language"];
  /**
   * Stop after this many configurations. By default pagination is followed to
   * the end.
   */
  limit?: number;
}

/**
 * List the sandbox configurations code evaluators can run in, newest first.
 *
 * Pass a configuration's `id` as `sandbox_config_id` when creating or updating
 * a code evaluator; only configurations with `is_usable` accept new code.
 * Provider credentials are never returned.
 *
 * @param params - Optional filters.
 * @param params.language - Return configurations for this language only.
 * @param params.limit - Stop after this many configurations.
 * @param params.client - An optional Phoenix client instance.
 * @returns The sandbox configurations.
 *
 * @requires Phoenix server >= 21.0.0
 *
 * @example
 * ```ts
 * import { getSandboxConfigs } from "@arizeai/phoenix-client/evaluators";
 *
 * const usable = (await getSandboxConfigs({ language: "PYTHON" })).filter((c) => c.is_usable);
 * ```
 */
export async function getSandboxConfigs({
  client: _client,
  language,
  limit,
}: GetSandboxConfigsParams = {}): Promise<SandboxConfig[]> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: LIST_SANDBOX_CONFIGS });

  const configs: SandboxConfig[] = [];
  let cursor: string | undefined;
  do {
    const remaining = limit === undefined ? 100 : limit - configs.length;
    const { data, error } = await client.GET("/v1/sandbox_configs", {
      params: { query: { language, cursor, limit: Math.min(100, remaining) } },
    });
    if (error) throw error;
    configs.push(...(data?.data ?? []));
    if (limit !== undefined && configs.length >= limit) {
      return configs.slice(0, limit);
    }
    cursor = data?.next_cursor ?? undefined;
  } while (cursor);
  return configs;
}
