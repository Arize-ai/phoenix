/** An HTTP response that could not be handled as a GraphQL response. */
export class ServerResponseError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ServerResponseError";
    this.status = status;
  }
}

/** How an intermediary or server response prevented a GraphQL request. */
export type ServerConnectionErrorKind = "timeout" | "unavailable";

const KIND_BY_STATUS: Readonly<
  Partial<Record<number, ServerConnectionErrorKind>>
> = {
  502: "unavailable",
  503: "unavailable",
  504: "timeout",
};

/**
 * Classifies an error as a failure to get a GraphQL response.
 *
 * Only tagged non-GraphQL HTTP responses are classified. A GraphQL error from
 * Phoenix may describe its own failed outbound connection and must remain an
 * application error.
 *
 * @param error - The thrown value to classify
 * @returns the kind of connection failure, or null if the error is not one
 */
export function classifyServerConnectionError(
  error: unknown
): ServerConnectionErrorKind | null {
  if (!(error instanceof ServerResponseError)) {
    return null;
  }

  return KIND_BY_STATUS[error.status] ?? null;
}

/**
 * Detects whether an error is a failure to get a GraphQL response, without
 * regard for how it failed.
 *
 * @param error - The thrown value to check
 * @returns true if the error is a connection failure of any kind
 */
export function isServerConnectionError(error: unknown): boolean {
  return classifyServerConnectionError(error) !== null;
}
