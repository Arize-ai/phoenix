import { getValueAtPath } from "@phoenix/utils/objectUtils";

/**
 * A value the experiment runner can convert into a chat message: an object
 * carrying a string `role`. Deliberately lenient — content shapes vary by
 * provider and the server does the real conversion.
 */
function isMessageLike(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { role?: unknown }).role === "string"
  );
}

function isMessageArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(isMessageLike);
}

const MAX_CANDIDATE_SEARCH_DEPTH = 4;

/**
 * Dot-notation paths within `value` that resolve to message arrays —
 * suggestion material for a failed validation.
 */
export function findMessageArrayPaths(
  value: unknown,
  prefix = "",
  depth = 0
): string[] {
  if (depth > MAX_CANDIDATE_SEARCH_DEPTH) {
    return [];
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }
  const paths: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isMessageArray(child)) {
      paths.push(path);
    } else {
      paths.push(...findMessageArrayPaths(child, path, depth + 1));
    }
  }
  return paths;
}

/**
 * Check that `path`, resolved against a dataset example's `input` object
 * (the base the experiment runner uses), yields a message list. On failure
 * the error names the base explicitly and suggests the paths where message
 * lists actually live, so a wrong guess is corrected in one step instead of
 * discovered through a failed run over the whole dataset.
 */
export function validateAppendedMessagesPath({
  exampleInput,
  path,
}: {
  exampleInput: unknown;
  path: string;
}): { ok: true } | { ok: false; error: string } {
  const resolved = getValueAtPath(exampleInput, path);
  if (isMessageArray(resolved)) {
    return { ok: true };
  }
  const candidates = findMessageArrayPaths(exampleInput);
  const suggestion =
    candidates.length > 0
      ? `The first example's input has a message list at: ${candidates
          .map((candidate) => `"${candidate}"`)
          .join(", ")}.`
      : `No message list was found in the first example's input` +
        (typeof exampleInput === "object" &&
        exampleInput !== null &&
        !Array.isArray(exampleInput)
          ? ` (its keys are: ${Object.keys(exampleInput)
              .map((key) => `"${key}"`)
              .join(", ")}).`
          : ".");
  return {
    ok: false,
    error:
      `Path "${path}" does not resolve to a message list in the loaded ` +
      `dataset's first example. The path is relative to each example's ` +
      `\`input\` object, not the whole example. ${suggestion}`,
  };
}
