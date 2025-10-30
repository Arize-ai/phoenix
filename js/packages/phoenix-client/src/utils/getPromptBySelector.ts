import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { PromptSelector } from "../types/prompts";

import invariant from "tiny-invariant";

/**
 * Parameters for the getPromptBySelector function
 */
export type GetPromptBySelectorParams = ClientFn & {
  /**
   * The prompt to get. Can be in the form of a prompt id, a prompt version id, a prompt name, or a prompt name + tag.
   */
  prompt: PromptSelector;
};

/**
 * Get a prompt from the Phoenix API.
 *
 * if the input is a prompt id, fetch the latest prompt version from the client.
 * if the input is a prompt version id, fetch that prompt version.
 * if the input is a prompt tag and name, fetch the prompt version that has that tag and name.
 * if the input is a prompt name, fetch the latest prompt version from the client.
 *
 * @param params - The parameters to get a prompt.
 * @returns The nearest prompt version that matches the selector, or null if it does not exist.
 */
export async function getPromptBySelector({
  client: _client,
  prompt,
}: GetPromptBySelectorParams) {
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
