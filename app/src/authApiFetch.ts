import createClient from "openapi-fetch";

import { authFetch } from "@phoenix/authFetch";
import { BASE_URL } from "@phoenix/config";

import type { paths } from "./__generated__/api/v1";

/**
 * Auth-aware `openapi-fetch` client for the Phoenix REST API.
 *
 * Use this for any call to a route described by the generated OpenAPI schema
 * (`app/src/__generated__/api/v1.ts`) — paths, query params, request bodies,
 * and responses are all type-checked against the spec, and the request is
 * piped through `authFetch` so it inherits auth-refresh on 401s.
 *
 * Reach for `authFetch` directly when there is no schema to type against:
 * Relay/GraphQL traffic, AI SDK streaming endpoints, or one-off non-REST
 * fetches.
 */
export const authApiFetch = createClient<paths>({
  baseUrl: BASE_URL,
  fetch: (request) => authFetch(request),
});
