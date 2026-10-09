import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import { LIST_EVALUATOR_VERSIONS } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { CodeEvaluatorVersion } from "../types/evaluators";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for listing a code evaluator's versions.
 */
export interface GetCodeEvaluatorVersionsParams extends ClientFn {
  /**
   * The GlobalID of the code evaluator.
   */
  evaluatorId: string;
  /**
   * Stop after this many versions. Pagination is followed to the end by
   * default.
   */
  limit?: number;
}

type VersionsPage = components["schemas"]["CodeEvaluatorVersionsResponseBody"];

const DEFAULT_PAGE_SIZE = 100;

/**
 * List the versions of a code evaluator, newest first. Pagination is handled
 * for you.
 *
 * The first entry is the version the evaluator currently runs.
 *
 * @param params - The evaluator to list versions for.
 * @param params.evaluatorId - The code evaluator GlobalID.
 * @param params.limit - Stop after this many versions.
 * @param params.client - An optional Phoenix client instance.
 * @returns The versions.
 *
 * @requires Phoenix server >= 21.0.0
 *
 * @example
 * ```ts
 * import { getCodeEvaluatorVersions } from "@arizeai/phoenix-client/evaluators";
 *
 * const [current, previous] = await getCodeEvaluatorVersions({
 *   evaluatorId: "Q29kZUV2YWx1YXRvcjoy",
 *   limit: 2,
 * });
 * ```
 */
export async function getCodeEvaluatorVersions({
  client: _client,
  evaluatorId,
  limit,
}: GetCodeEvaluatorVersionsParams): Promise<CodeEvaluatorVersion[]> {
  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: LIST_EVALUATOR_VERSIONS,
  });

  const versions: CodeEvaluatorVersion[] = [];
  let cursor: string | null | undefined = null;

  do {
    const remaining =
      limit === undefined ? DEFAULT_PAGE_SIZE : limit - versions.length;
    const response: { data?: VersionsPage; error?: unknown } = await client.GET(
      "/v1/evaluators/{evaluator_id}/versions",
      {
        params: {
          path: { evaluator_id: evaluatorId },
          query: {
            cursor,
            limit: Math.max(1, Math.min(remaining, DEFAULT_PAGE_SIZE)),
          },
        },
      }
    );

    if (response.error) throw response.error;
    invariant(response.data?.data, "Failed to list evaluator versions");

    cursor = response.data.next_cursor ?? null;
    versions.push(...response.data.data);
    if (limit !== undefined && versions.length >= limit) {
      return versions.slice(0, limit);
    }
  } while (cursor != null);

  return versions;
}
