import type { ElicitToolInput } from "./elicitToolTypes";
import { elicitToolInputSchema } from "./elicitToolTypes";

/**
 * Parses and validates the raw tool input into a typed {@link ElicitToolInput}.
 * Returns `null` if the input is malformed.
 *
 * Uses the {@link elicitToolInputSchema} zod schema for validation, ensuring
 * the parsed data conforms to the expected structure. Also handles
 * JSON-string-encoded `questions` values from transports that serialize arrays.
 */
export function parseElicitToolInput(input: unknown): ElicitToolInput | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  // Some transports serialize the questions array as a JSON string.
  // Pre-process to normalize before handing off to zod.
  let normalized: unknown;
  if ("questions" in input && typeof input.questions === "string") {
    try {
      normalized = { ...input, questions: JSON.parse(input.questions) };
    } catch {
      return null;
    }
  } else {
    normalized = input;
  }

  const result = elicitToolInputSchema.safeParse(normalized);
  if (!result.success) {
    return null;
  }
  return result.data;
}
