import invariant from "tiny-invariant";

import { createClient } from "../client";
import { CREATE_EVALUATOR_VERSION } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type {
  CodeEvaluatorVersionCreate,
  CreatedCodeEvaluatorVersion,
} from "../types/evaluators";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for appending a version to a code evaluator.
 */
export interface CreateCodeEvaluatorVersionParams extends ClientFn {
  /**
   * The GlobalID of the code evaluator.
   */
  evaluatorId: string;
  /**
   * The full source of the new version.
   */
  sourceCode: string;
  /**
   * The version believed to be current. When another version has been
   * appended since, the server refuses with 409 instead of deploying over it.
   */
  expectedCurrentVersionId?: string;
  /**
   * Configuration applied in the same transaction as the new code, so bindings
   * never run it with the old sandbox, input mapping, or outputs. Omitted
   * fields keep their values.
   */
  configuration?: Omit<
    CodeEvaluatorVersionCreate,
    "source_code" | "expected_current_version_id"
  >;
}

/**
 * Append a new immutable version of a code evaluator's source, optionally
 * with the configuration the new code needs.
 *
 * If the source matches the current version, the existing version is returned
 * and `was_created` is `false`. Only the current version is compared, so
 * restoring older source creates a new version.
 *
 * @param params - The evaluator, its new source, and optional configuration.
 * @param params.evaluatorId - The code evaluator GlobalID.
 * @param params.sourceCode - The full source of the new version.
 * @param params.expectedCurrentVersionId - Refuse to deploy over a newer version.
 * @param params.configuration - Sandbox, input mapping, outputs, or description to apply with the code.
 * @param params.client - An optional Phoenix client instance.
 * @returns The persisted code version.
 *
 * @requires Phoenix server >= 21.0.0
 *
 * @example
 * ```ts
 * import { readFile } from "node:fs/promises";
 * import {
 *   createCodeEvaluatorVersion,
 *   getEvaluator,
 * } from "@arizeai/phoenix-client/evaluators";
 *
 * const current = await getEvaluator({ evaluatorId: "Q29kZUV2YWx1YXRvcjoy" });
 * const version = await createCodeEvaluatorVersion({
 *   evaluatorId: "Q29kZUV2YWx1YXRvcjoy",
 *   sourceCode: await readFile("evaluator.py", "utf8"),
 *   expectedCurrentVersionId:
 *     current.type === "code" ? (current.current_version_id ?? undefined) : undefined,
 * });
 * console.log(version.id, version.was_created);
 * ```
 */
export async function createCodeEvaluatorVersion({
  client: _client,
  evaluatorId,
  sourceCode,
  expectedCurrentVersionId,
  configuration,
}: CreateCodeEvaluatorVersionParams): Promise<CreatedCodeEvaluatorVersion> {
  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: CREATE_EVALUATOR_VERSION,
  });

  const { data, error } = await client.POST(
    "/v1/evaluators/{evaluator_id}/versions",
    {
      params: { path: { evaluator_id: evaluatorId } },
      body: {
        source_code: sourceCode,
        ...(expectedCurrentVersionId !== undefined && {
          expected_current_version_id: expectedCurrentVersionId,
        }),
        ...configuration,
      },
    }
  );

  if (error) throw error;
  invariant(data?.data, "Failed to create evaluator version");
  return data.data;
}
