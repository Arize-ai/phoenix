import type { SetSpansFilterInput } from "./types";

/** Parse the server-provided span filter tool payload into the client action shape. */
export function parseSetSpansFilterInput(
  input: unknown
): SetSpansFilterInput | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as {
    condition?: unknown;
  };
  if (typeof candidate.condition !== "string") return null;
  return {
    condition: candidate.condition,
  };
}
