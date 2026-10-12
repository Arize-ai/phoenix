import { createClient } from "../client";
import { UPSERT_PROMPT_VERSION_TAG } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { GetPromptByVersionSelector } from "../types/prompts";
import { resolvePromptVersionId } from "../utils/resolvePromptVersionId";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for creating or moving a prompt version tag.
 */
export interface UpsertPromptVersionTagParams extends ClientFn {
  /** The prompt version that should own the tag. */
  prompt: GetPromptByVersionSelector;
  /** The prompt-scoped tag name. */
  name: string;
  /** An optional description for the tag. */
  description?: string | null;
}

/**
 * Create a prompt version tag or move an existing tag to another version.
 *
 * Tag names are unique within a prompt. If another version of the same prompt
 * already has `name`, the tag is moved to the selected version and its
 * description is updated.
 *
 * @param params - The prompt version tag to create or move.
 * @param params.prompt - The target prompt, selected by version ID.
 * @param params.name - The prompt-scoped tag name.
 * @param params.description - An optional description for the tag.
 * @returns A promise that resolves once the tag has been created or moved.
 * @throws {@link HttpError} when Phoenix rejects the request.
 *
 * @example
 * ```ts
 * import { upsertPromptVersionTag } from "@arizeai/phoenix-client/prompts";
 *
 * await upsertPromptVersionTag({
 *   prompt: { versionId: "UHJvbXB0VmVyc2lvbjox" },
 *   name: "production",
 *   description: "Currently deployed version",
 * });
 * ```
 */
export async function upsertPromptVersionTag({
  client: _client,
  prompt,
  name,
  description,
}: UpsertPromptVersionTagParams): Promise<void> {
  const promptVersionId = resolvePromptVersionId(prompt);
  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: UPSERT_PROMPT_VERSION_TAG,
  });

  await client.POST("/v1/prompt_versions/{prompt_version_id}/tags", {
    params: {
      path: {
        prompt_version_id: promptVersionId,
      },
    },
    body: {
      name,
      description,
    },
  });
}
