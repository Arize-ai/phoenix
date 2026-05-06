import createClient from "openapi-fetch";

import { authFetch } from "@phoenix/authFetch";
import { BASE_URL } from "@phoenix/config";

import type { paths } from "../__generated__/api/v1";

export const apiFetch = createClient<paths>({
  baseUrl: BASE_URL,
  fetch: (request) => authFetch(request),
});
