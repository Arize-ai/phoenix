import { createClient } from "../client";
import { ClientFn } from "../types/core";

/**
 * Parameters to delete a span
 */
export interface DeleteSpanParams extends ClientFn {
  /**
   * The span identifier. Can be either:
   * - OpenTelemetry span_id (string)
   * - Phoenix Global ID (string)
   */
  spanIdentifier: string;
}

/**
 * Delete a single span by identifier.
 *
 * **Important**: This operation deletes ONLY the specified span itself and does NOT
 * delete its descendants/children. All child spans will remain in the trace and
 * become orphaned (their parent_id will point to a non-existent span).
 *
 * Behavior:
 * - Deletes only the target span (preserves all descendant spans)
 * - Child spans become orphaned but remain in the database
 * - Returns successfully if span is found and deleted
 * - Throws error if span is not found (404) or other errors occur
 *
 * @experimental this function is experimental and may change in the future
 *
 * @param params - The parameters to delete a span
 * @returns Promise that resolves when the span is successfully deleted
 * @throws Error if the span is not found or deletion fails
 *
 * @example
 * ```ts
 * // Delete by OpenTelemetry span_id
 * await deleteSpan({
 *   client,
 *   spanIdentifier: "abc123def456"
 * });
 *
 * // Delete by Phoenix Global ID
 * await deleteSpan({
 *   client,
 *   spanIdentifier: "U3BhbjoyMzQ1Njc4OQ=="
 * });
 * ```
 */
export async function deleteSpan({
  client: _client,
  spanIdentifier,
}: DeleteSpanParams): Promise<void> {
  const client = _client ?? createClient();

  const { error } = await client.DELETE("/v1/spans/{span_identifier}", {
    params: {
      path: {
        span_identifier: spanIdentifier,
      },
    },
  });

  if (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 404;
    if (isNotFound) {
      throw new Error(`Span not found: ${spanIdentifier}`);
    }

    // Extract meaningful error information
    const errorMessage =
      typeof error === "object" && error !== null
        ? JSON.stringify(error, null, 2)
        : String(error);
    throw new Error(`Failed to delete span: ${errorMessage}`);
  }
}
