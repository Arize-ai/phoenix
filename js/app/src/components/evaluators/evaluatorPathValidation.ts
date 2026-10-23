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
 * A path that does not parse is wrong on its own. One that parses but reads
 * nothing is only wrong once a record has been read: until one is sampled the
 * source is the record kind's skeleton, which has the top-level keys and
 * nothing under them, so every real path would read as missing there. That
 * is what the mapping dock sits on while the test bench's records load, and
 * what it is left with when none match, and neither says the path is wrong.
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
