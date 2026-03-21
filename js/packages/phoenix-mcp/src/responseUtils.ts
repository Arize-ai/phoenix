/**
 * Shape returned by the `openapi-fetch` client's `GET` / `POST` methods.
 */
export type PhoenixResponse<TData> = {
  data?: TData;
  error?: unknown;
};

/**
 * Unwrap a Phoenix API response, returning its data or throwing
 * a descriptive error suitable for MCP tool consumers.
 *
 * @param options.response - The raw response from the Phoenix REST client.
 * @param options.errorPrefix - A human-readable prefix prepended to any error message
 *   (e.g. `"Failed to fetch datasets"`).
 * @returns The unwrapped response data.
 * @throws When the response contains an error or no data.
 */
export function getResponseData<TData>({
  response,
  errorPrefix,
}: {
  response: PhoenixResponse<TData>;
  errorPrefix: string;
}): TData {
  if (response.error || response.data === undefined) {
    throw new Error(
      `${errorPrefix}: ${response.error instanceof Error ? response.error.message : String(response.error || "Unknown error")}`
    );
  }

  return response.data;
}
