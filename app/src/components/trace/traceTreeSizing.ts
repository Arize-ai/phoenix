/** Minimum space defended by the timing graph while it is visible. */
export const TRACE_TREE_TIMING_MIN_WIDTH_PIXELS = 150;

/** size-6000; maximum width owned by the trace-tree name region. */
export const TRACE_TREE_NAME_MAX_WIDTH_PIXELS = 480;

/** size-8000; maximum width owned by the trace-tree timing region. */
export const TRACE_TREE_TIMING_MAX_WIDTH_PIXELS = 640;

/**
 * Derives the trace-tree panel maximum from the regions currently rendered by
 * the child. New regions extend this composition without changing the panel
 * sizing machine.
 */
export function getTraceTreeMaximumWidth({
  hasTiming,
}: {
  hasTiming: boolean;
}): number {
  return (
    TRACE_TREE_NAME_MAX_WIDTH_PIXELS +
    (hasTiming ? TRACE_TREE_TIMING_MAX_WIDTH_PIXELS : 0)
  );
}
