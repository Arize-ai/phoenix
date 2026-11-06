/**
 * Server-advertised, client-executed: the server owns the canonical schema
 * and description (see agents/tools/set_spans_filter.py); this name is the
 * single source of truth for routing the call to the matching client action
 * registered by `SpanFiltersContext`. The tool consolidates control over
 * both the freeform filter condition and the root-vs-all-spans toggle.
 */
export const SET_SPANS_FILTER_TOOL_NAME = "set_spans_filter";
