export type PhoenixResponse<TData> = {
  data?: TData;
  error?: unknown;
};

/**
 * Unwrap a Phoenix API response or throw a tool-friendly error message.
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
