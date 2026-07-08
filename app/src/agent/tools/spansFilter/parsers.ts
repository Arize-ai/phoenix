import type { SetSpansFilterInput } from "./types";

/** Parse the server-provided span filter tool payload into the client action shape. */
export function parseSetSpansFilterInput(
  input: unknown
): SetSpansFilterInput | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as {
    condition?: unknown;
    rootSpansOnly?: unknown;
  };
  if (typeof candidate.condition !== "string") return null;
  if (typeof candidate.rootSpansOnly !== "boolean") return null;
  return {
    condition: candidate.condition,
    rootSpansOnly: candidate.rootSpansOnly,
  };
}
