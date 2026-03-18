import { authFetch } from "@phoenix/authFetch";
import { BASE_URL } from "@phoenix/config";

import type { GraphQLResponse } from "./graphqlPageContextTypes";

export async function fetchGraphQL<TData, TVariables>(
  query: string,
  variables: TVariables
) {
  const response = await authFetch(`${BASE_URL}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!(response instanceof Response)) {
    throw new Error("Expected authFetch to return a Response");
  }

  const payload = (await response.json()) as GraphQLResponse<TData>;

  if (!response.ok) {
    throw new Error(`Failed to fetch page context: ${response.status}`);
  }

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) {
    throw new Error("Page context query returned no data");
  }

  return payload.data;
}
