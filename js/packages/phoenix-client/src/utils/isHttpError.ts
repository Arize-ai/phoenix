/**
 * Type guard to check if an error is an HTTP error with a response status code.
 * This safely narrows the type without unsafe type assertions.
 *
 * @param error - The error to check
 * @returns True if the error has a response.status property
 */
export function isHttpError(
  error: unknown
): error is { response: { status: number } } {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if (!("response" in error)) {
    return false;
  }

  const response = error.response;

  if (typeof response !== "object" || response === null) {
    return false;
  }

  return "status" in response && typeof response.status === "number";
}

/**
 * Safely checks if an error is an HTTP error with a specific status code.
 *
 * @param error - The error to check
 * @param statusCode - The status code to check for
 * @returns True if the error has the specified status code
 */
export function isHttpErrorWithStatus(
  error: unknown,
  statusCode: number
): boolean {
  return isHttpError(error) && error.response.status === statusCode;
}
