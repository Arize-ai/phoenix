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

/**
 * Search params scoped to a specific selection within trace/session detail
 * views. These are dropped when navigating away from a selection while
 * recreatable params (such as the time range) are preserved.
 */
export const SELECTION_SCOPED_SEARCH_PARAMS = [
  SELECTED_TRACE_ID_PARAM,
  SELECTED_SPAN_NODE_ID_PARAM,
] as const;

/**
 * Optional search param that contains UI metadata for the selected tracing
 * time range key. Canonical URL state lives in the start/end params below.
 */
export const TIME_RANGE_KEY_PARAM = "timeRangeKey";

/**
 * The canonical ISO datetime lower bound for the tracing time range.
 */
export const TIME_RANGE_START_PARAM = "timeRangeStart";

/**
 * The canonical ISO datetime upper bound for the tracing time range.
 */
export const TIME_RANGE_END_PARAM = "timeRangeEnd";

/**
 * The search param that holds the label ids used to filter a list of resources
 * (e.g. prompts or datasets). Stored as a repeated param so multiple labels can
 * be selected, e.g. `?labelId=a&labelId=b`. Persisting to the URL makes the
 * label filter shareable and lets it survive reloads.
 */
export const LABEL_ID_PARAM = "labelId";

export const CREATE_CODE_EVALUATOR_PARAM = "createCodeEvaluator";

export const CREATE_LLM_EVALUATOR_PARAM = "createLlmEvaluator";
