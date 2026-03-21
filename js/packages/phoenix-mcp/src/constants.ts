// ============================================================
// Pagination
// ============================================================

/** Default number of items fetched per API page request. */
export const DEFAULT_PAGE_SIZE = 100;

// ============================================================
// Span queries
// ============================================================

/** Maximum number of spans that a single query may return. */
export const MAX_SPAN_QUERY_LIMIT = 1000;

// ============================================================
// List queries (datasets, experiments, projects, configs)
// ============================================================

/** Upper bound for the `limit` parameter on list endpoints. */
export const MAX_LIST_LIMIT = 500;

// ============================================================
// Annotation fetching
// ============================================================

/** Number of span IDs included in each annotation chunk request. */
export const ANNOTATION_CHUNK_SIZE = 100;

/** Maximum number of annotation chunk requests executed concurrently. */
export const MAX_CONCURRENT_ANNOTATION_REQUESTS = 5;

/** Page size used when exhausting annotation pages within a single chunk. */
export const ANNOTATION_PAGE_SIZE = 1000;

// ============================================================
// Trace queries
// ============================================================

/** Default number of traces returned by the list-traces tool. */
export const DEFAULT_TRACE_PAGE_SIZE = 10;

/** Maximum number of traces the list-traces tool may return. */
export const MAX_TRACE_PAGE_SIZE = 100;

// ============================================================
// Session queries
// ============================================================

/** Maximum number of sessions the list-sessions tool may return. */
export const MAX_SESSION_PAGE_SIZE = 100;

// ============================================================
// Prompt defaults
// ============================================================

/** Default model provider when creating a prompt version. */
export const DEFAULT_MODEL_PROVIDER = "OPENAI" as const;

/** Default model name when creating a prompt version. */
export const DEFAULT_MODEL_NAME = "gpt-4";

/** Default sampling temperature when creating a prompt version. */
export const DEFAULT_TEMPERATURE = 0.7;

/**
 * Default `max_tokens` for Anthropic prompt versions.
 *
 * Anthropic models require an explicit `max_tokens` invocation parameter.
 */
export const ANTHROPIC_DEFAULT_MAX_TOKENS = 1000;

// ============================================================
// Time
// ============================================================

/** Number of milliseconds in one minute. */
export const MS_PER_MINUTE = 60_000;

// ============================================================
// MCP metadata
// ============================================================

/** Provenance tag applied to dataset examples created through the MCP server. */
export const MCP_SYNTHETIC_SOURCE = "Synthetic Example added via MCP";
