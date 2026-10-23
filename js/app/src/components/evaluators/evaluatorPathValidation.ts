import { resolveEvaluatorPath } from "./evaluatorPathCompletions";

export const UNRESOLVED_PATH_MESSAGE = "No such field";
export const INVALID_PATH_MESSAGE = "Not a valid path";

/** What is wrong with a mapping path, and the text that is wrong. */
export type EvaluatorPathError = {
  status: "unresolved" | "invalid";
  errorMessage: string;
  range: { from: number; to: number };
};

/**
 * What is wrong with a mapping path, or null where nothing is known to be.
 *
 * A path that does not parse is always wrong. One that reads nothing is only
 * wrong once a record has been sampled: before that the source is a skeleton
 * with nothing under its top-level keys, so every real path would be missing.
 */
export function getEvaluatorPathError({
  source,
  path,
  hasSampledRecord,
}: {
  source: Record<string, unknown>;
  path: string;
  hasSampledRecord: boolean;
}): EvaluatorPathError | null {
  const resolution = resolveEvaluatorPath({ source, path });
  if (resolution.status === "invalid") {
    return {
      status: "invalid",
      errorMessage: INVALID_PATH_MESSAGE,
      range: resolution.range,
    };
  }
  if (resolution.status === "unresolved" && hasSampledRecord) {
    return {
      status: "unresolved",
      errorMessage: UNRESOLVED_PATH_MESSAGE,
      range: resolution.range,
    };
  }
  return null;
}
