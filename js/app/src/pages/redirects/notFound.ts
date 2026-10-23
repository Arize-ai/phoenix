import { data } from "react-router";

import { isConnectionTimeoutError } from "@phoenix/components/exception/isConnectionTimeoutError";

export type NotFoundErrorData =
  | { kind: "entity"; entityType: string; identifier?: string }
  | { kind: "project-onboarding"; projectName: string };

export function notFound(payload: NotFoundErrorData) {
  return data(payload, { status: 404 });
}

/**
 * Whether a lookup failed because the server could not be reached, as opposed
 * to the server rejecting it (e.g. an id that names no node). Only the latter
 * means the entity was not found.
 */
export function isServerUnreachableError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "Failed to fetch" || isConnectionTimeoutError(error))
  );
}
