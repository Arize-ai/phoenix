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
 * Build a relative path to a trace's details, preserving recreatable URL state
 * (such as the selected time range) while setting or clearing the selected
 * span.
 */
export function getTraceDetailsPath({
  traceId,
  spanNodeId,
  searchParams,
}: {
  traceId: string;
  spanNodeId?: string | null;
  searchParams: URLSearchParams;
}): string {
  return `${traceId}${withSearchParams(searchParams, (params) => {
    if (spanNodeId) {
      params.set(SELECTED_SPAN_NODE_ID_PARAM, spanNodeId);
    } else {
      params.delete(SELECTED_SPAN_NODE_ID_PARAM);
    }
  })}`;
}

/**
 * Build a relative path to a session's details, preserving recreatable URL
 * state while clearing the selection-scoped params.
 */
export function getSessionDetailsPath({
  sessionId,
  searchParams,
}: {
  sessionId: string;
  searchParams: URLSearchParams;
}): string {
  return `${encodeURIComponent(sessionId)}${clearSelectionScopedParams(
    searchParams
  )}`;
}
