import { createClient } from "../client";
import { DELETE_PROMPT_VERSION_TAG } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { GetPromptByVersionSelector } from "../types/prompts";
import { resolvePromptVersionId } from "../utils/resolvePromptVersionId";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for deleting a prompt version tag.
 */
export interface DeletePromptVersionTagParams extends ClientFn {
  /** A version belonging to the prompt that owns the tag. */
  prompt: GetPromptByVersionSelector;
  /** The prompt-scoped tag name to delete. */
  name: string;
}

/**
 * Delete a tag from the prompt that owns the given prompt version.
 *
 * Tag names are unique within a prompt, so `name` identifies the tag across
 * all versions of that prompt. The tag does not need to be attached to the
 * selected version.
 *
 * @param params - The prompt version tag to delete.
 * @param params.prompt - A version selector used to identify the prompt.
 * @param params.name - The prompt-scoped tag name to delete.
 * @returns A promise that resolves once the tag has been deleted.
 * @throws {@link HttpError} when Phoenix rejects the request.
 *
 * @example
 * ```ts
 * import { deletePromptVersionTag } from "@arizeai/phoenix-client/prompts";
 *
 * await deletePromptVersionTag({
 *   prompt: { versionId: "UHJvbXB0VmVyc2lvbjox" },
 *   name: "production",
 * });
 * ```
 */
export async function deletePromptVersionTag({
  client: _client,
  prompt,
  name,
}: DeletePromptVersionTagParams): Promise<void> {
  const promptVersionId = resolvePromptVersionId(prompt);
  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: DELETE_PROMPT_VERSION_TAG,
  });

  await client.DELETE(
    "/v1/prompt_versions/{prompt_version_id}/tags/{tag_name}",
    {
      params: {
        path: {
          prompt_version_id: promptVersionId,
          tag_name: name,
        },
      },
    }
  );
}
