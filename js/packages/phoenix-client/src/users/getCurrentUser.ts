import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import type { ClientFn } from "../types/core";

/** The user profile returned for the current Phoenix client credentials. */
export type CurrentUser =
  components["schemas"]["GetViewerResponseBody"]["data"];

/**
 * Get the currently authenticated user.
 *
 * When authentication is disabled, Phoenix returns an anonymous user with
 * `auth_method: "ANONYMOUS"`.
 *
 * @param params - The parameters for fetching the current user.
 * @param params.client - An optional Phoenix client instance.
 * @returns The current user's generated API profile shape.
 * @throws {HttpError} If the request is not authenticated or is forbidden.
 *
 * @example
 * ```ts
 * import { getCurrentUser } from "@arizeai/phoenix-client/users";
 *
 * const user = await getCurrentUser();
 * console.log(user.auth_method);
 * ```
 */
export async function getCurrentUser({
  client: _client,
}: ClientFn = {}): Promise<CurrentUser> {
  const client = _client ?? createClient();
  const { data, error } = await client.GET("/v1/user");

  if (error) throw error;
  invariant(data?.data, "Failed to get current user");
  return data.data;
}
