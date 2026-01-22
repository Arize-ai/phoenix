import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { Prompt } from "../types/prompts";

import invariant from "tiny-invariant";

export type ListPromptsParams = ClientFn;

/**
 * List all prompts available to the client.
 *
 * @example
 * ```ts
 * import { listPrompts } from "@arizeai/phoenix-client/prompts";
 *
 * const prompts = await listPrompts({});
 * console.log(prompts);
 * ```
 *
 * @throws {Error} If the prompts cannot be listed or the response is invalid.
 */
export async function listPrompts({
  client: _client,
}: ListPromptsParams): Promise<Prompt[]> {
  const client = _client || createClient();
  const response = await client.GET("/v1/prompts");
  invariant(response.data?.data, "Failed to list prompts");
  return response.data.data;
}
