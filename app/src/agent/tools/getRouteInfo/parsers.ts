import { normalizePath } from "./catalog";
import { DEFAULT_LIMIT, MAX_LIMIT } from "./constants";
import type { GetRouteInfoInput } from "./types";

/**
 * Normalizes path input from either a raw path or a full URL.
 *
 * @param path - Path or URL provided by the tool caller.
 */
export function normalizeInputPath(path: string): string {
  try {
    // The browser URL parser lets the tool accept absolute URLs while still
    // comparing only the Phoenix-internal pathname against route patterns.
    const url = new URL(path, window.location.href);
    return normalizePath(url.pathname);
  } catch {
    return normalizePath(path);
  }
}

/**
 * Validates and normalizes raw tool input from the browser tool registry.
 *
 * @param input - Unknown tool input provided by the model/tool call.
 */
export function parseGetRouteInfoInput(
  input: unknown
): GetRouteInfoInput | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const candidate = input as {
    query?: unknown;
    path?: unknown;
    limit?: unknown;
  };
  if (candidate.query !== undefined && typeof candidate.query !== "string") {
    return null;
  }
  if (candidate.path !== undefined && typeof candidate.path !== "string") {
    return null;
  }
  let limit = DEFAULT_LIMIT;
  if (candidate.limit !== undefined) {
    if (
      typeof candidate.limit !== "number" ||
      !Number.isInteger(candidate.limit) ||
      candidate.limit <= 0
    ) {
      return null;
    }
    limit = candidate.limit;
  }
  return {
    // Preserve whether query/path were omitted so the response mirrors the
    // caller input without adding empty fields.
    ...(candidate.query !== undefined ? { query: candidate.query } : {}),
    ...(candidate.path !== undefined ? { path: candidate.path } : {}),
    limit: Math.min(limit, MAX_LIMIT),
  };
}
