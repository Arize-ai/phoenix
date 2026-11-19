import {
  SELECTED_SPAN_NODE_ID_PARAM,
  SELECTION_SCOPED_SEARCH_PARAMS,
} from "@phoenix/constants/searchParams";

const videoUrlRegex = /\.(mp4|mov|webm|ogg)(\?|$)/i;
const audioUrlRegex = /\.(mp3|wav)(\?|$)/i;
export function isVideoUrl(url: string): boolean {
  return videoUrlRegex.test(url);
}

export function isAudioUrl(url: string): boolean {
  return audioUrlRegex.test(url);
}

/**
 * Clone the given search, apply a mutation, and serialize back to a query
 * string with a leading "?" (or "" when empty). Centralizes the
 * clone/mutate/stringify boilerplate used to build navigation targets that
 * preserve unrelated URL state.
 */
export function withSearchParams(
  search: string | URLSearchParams,
  mutate: (params: URLSearchParams) => void
): string {
  const params = new URLSearchParams(search);
  mutate(params);
  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}

/**
 * Drop the selection-scoped params (such as the selected trace/span) from the
 * given search, preserving everything else. Used to build navigation targets
 * that leave a detail selection while keeping recreatable state like the time
 * range.
 */
export function clearSelectionScopedParams(
  search: string | URLSearchParams
): string {
  return withSearchParams(search, (params) => {
    for (const param of SELECTION_SCOPED_SEARCH_PARAMS) {
      params.delete(param);
    }
  });
}

/**
 * Build the absolute path to a trace's details under `basePath`, preserving
 * recreatable URL state (such as the selected time range) while setting or
 * clearing the selected span.
 *
 * The path is absolute because React Router resolves a relative navigation
 * against the router's current matches, not the route that rendered the
 * caller. A click on a table still on screen while a transition to another
 * tab is pending would otherwise land under that tab's route.
 *
 * The trace ID is URL-encoded because it originates from ingested span data
 * and is not guaranteed to be a path-safe value. Encoding collapses it into a
 * single same-origin path segment, so a value beginning with `//` cannot be
 * resolved by React Router or the browser as a protocol-relative, cross-origin
 * `href`.
 */
export function getTraceDetailsPath({
  basePath,
  traceId,
  spanNodeId,
  searchParams,
}: {
  basePath: string;
  traceId: string;
  spanNodeId?: string | null;
  searchParams: URLSearchParams;
}): string {
  return `${basePath}/${encodeURIComponent(traceId)}${withSearchParams(
    clearSelectionScopedParams(searchParams),
    (params) => {
      if (spanNodeId) {
        params.set(SELECTED_SPAN_NODE_ID_PARAM, spanNodeId);
      }
    }
  )}`;
}

/**
 * Build the absolute path to a session's details under `basePath`, preserving
 * recreatable URL state while clearing the selection-scoped params. See
 * {@link getTraceDetailsPath} for why the path is absolute.
 */
export function getSessionDetailsPath({
  basePath,
  sessionId,
  searchParams,
}: {
  basePath: string;
  sessionId: string;
  searchParams: URLSearchParams;
}): string {
  return `${basePath}/${encodeURIComponent(sessionId)}${clearSelectionScopedParams(
    searchParams
  )}`;
}
