/**
 * The search param that contains the span node id of the selected span.
 * This is used to highlight the selected span in trace details views.
 */
export const SELECTED_SPAN_NODE_ID_PARAM = "selectedSpanNodeId";

/**
 * The search param that contains the selected session details sub-view.
 * This is used to preserve the active session tab across reloads and links.
 */
export const SESSION_VIEW_PARAM = "sessionView";

/**
 * The search param that contains the selected trace id within a session
 * details view. Used to preserve and restore the selected turn across
 * navigation.
 */
export const SELECTED_TRACE_ID_PARAM = "selectedTraceId";
