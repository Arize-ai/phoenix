import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import { LIST_EVALUATORS } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { EvaluatorDefinition, EvaluatorType } from "../types/evaluators";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for listing shared evaluator definitions.
 */
export interface GetEvaluatorsParams extends ClientFn {
  /**
   * Return only one kind of definition. All kinds are returned by default.
   */
  type?: EvaluatorType;
  /**
   * Return only the evaluator with this exact name.
   */
  name?: string;
  /**
   * Stop after this many definitions. Pagination is followed to the end by
   * default; every item embeds its current code or prompt version, so prefer
   * `name` or `limit` when looking for one evaluator.
   */
  limit?: number;
}

type EvaluatorsPage = components["schemas"]["EvaluatorDefinitionsResponseBody"];

const DEFAULT_PAGE_SIZE = 100;

/**
 * List shared evaluator definitions, newest first. Pagination is handled for
 * you.
 *
 * Every definition is returned whether or not a project or dataset binds it.
 *
 * @param params - Optional filters.
 * @param params.type - Return only `"llm"`, `"code"`, or `"builtin"` definitions.
 * @param params.name - Return only the evaluator with this exact name.
 * @param params.limit - Stop after this many definitions.
 * @param params.client - An optional Phoenix client instance.
 * @returns The definitions.
 *
 * @requires Phoenix server >= 21.0.0
 *
 * @example
 * ```ts
 * import { getEvaluators } from "@arizeai/phoenix-client/evaluators";
 *
 * for (const evaluator of await getEvaluators({ type: "code", limit: 20 })) {
 *   console.log(evaluator.id, evaluator.name);
 * }
 * ```
 */
export async function getEvaluators({
  client: _client,
  type,
  name,
  limit,
}: GetEvaluatorsParams = {}): Promise<EvaluatorDefinition[]> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: LIST_EVALUATORS });

  const definitions: EvaluatorDefinition[] = [];
  let cursor: string | null | undefined = null;

  do {
    const remaining =
      limit === undefined ? DEFAULT_PAGE_SIZE : limit - definitions.length;
    const response: { data?: EvaluatorsPage; error?: unknown } =
      await client.GET("/v1/evaluators", {
        params: {
          query: {
            ...(type !== undefined && { type }),
            ...(name !== undefined && { name }),
            cursor,
            limit: Math.max(1, Math.min(remaining, DEFAULT_PAGE_SIZE)),
          },
        },
      });

    if (response.error) throw response.error;
    invariant(response.data?.data, "Failed to list evaluators");

    cursor = response.data.next_cursor ?? null;
    definitions.push(...response.data.data);
    if (limit !== undefined && definitions.length >= limit) {
      return definitions.slice(0, limit);
    }
  } while (cursor != null);

  return definitions;
}
