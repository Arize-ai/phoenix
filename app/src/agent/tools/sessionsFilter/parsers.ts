import type { SetSessionsFilterInput } from "./types";

/** Parse the server-provided sessions filter payload into the client action shape. */
export function parseSetSessionsFilterInput(
  input: unknown
): SetSessionsFilterInput | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as {
    condition?: unknown;
  };
  if (typeof candidate.condition !== "string") return null;
  return {
    condition: candidate.condition,
  };
}
