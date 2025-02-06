import invariant from "tiny-invariant";
import { PromptLike } from "../types/prompts";
import { ClientFn } from "../types/core";
import { createClient } from "../client";

/**
 * Parameters for the getPromptVersionLike function
 */
export type GetPromptVersionLikeParams = ClientFn & {
  prompt: PromptLike;
};

/**
 * Get a prompt version from the Phoenix API.
 *
 * if the input is a prompt id, fetch the latest prompt version from the client.
 * if the input is a prompt version id, fetch that prompt version.
 * if the input is a prompt tag and name, fetch the prompt version that has that tag and name.
 * if the input is a prompt name, fetch the latest prompt version from the client.
 */
export async function getPromptVersionLike({
  client: _client,
  prompt,
}: GetPromptVersionLikeParams) {
  try {
    const client = _client ?? createClient();
    if ("promptId" in prompt) {
      throw new Error("Prompt by id not implemented");
    }
    if ("versionId" in prompt) {
      const response = await client.GET(
        `/v1/prompt_versions/{prompt_version_id}`,
        {
          params: { path: { prompt_version_id: prompt.versionId } },
        }
      );
      invariant(
        response.data?.data,
        `Prompt version ${prompt.versionId} not found`
      );
      return response.data.data;
    }
    if ("tag" in prompt && "name" in prompt) {
      const response = await client.GET(
        `/v1/prompts/{prompt_identifier}/tags/{tag_name}`,
        {
          params: {
            path: { prompt_identifier: prompt.name, tag_name: prompt.tag },
          },
        }
      );
      invariant(response.data?.data, `Prompt tag ${prompt.tag} not found`);
      return response.data.data;
    }
    if ("name" in prompt) {
      const response = await client.GET(
        `/v1/prompts/{prompt_identifier}/latest`,
        {
          params: {
            path: { prompt_identifier: prompt.name },
          },
        }
      );
      invariant(response.data?.data, `Prompt ${prompt.name} not found`);
      return response.data.data;
    }
    throw new Error("Invalid prompt");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return null;
  }
}
