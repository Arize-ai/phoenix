/** size-4600; preferred width of the navigation content, excluding timing. */
export const TRACE_TREE_DEFAULT_WIDTH_PIXELS = 368;

/** Storage key for the user's deliberate trace-tree column width. */
export const TRACE_TREE_WIDTH_STORAGE_KEY = "arize-phoenix-trace-tree-width";

/** size-3000; smallest useful width for the navigation content. */
export const TRACE_TREE_MIN_WIDTH_PIXELS = 240;

/** size-600; compact rail retained so the navigation can be reopened. */
export const TRACE_TREE_COLLAPSED_WIDTH_PIXELS = 48;

/** size-3000; compact search presentation applies below this width. */
export const TRACE_TREE_HOVER_WIDTH_PIXELS = 240;

/** size-1600; toolbar controls stack below this allocated width. */
export const TRACE_TREE_TOOLBAR_STACK_WIDTH_PIXELS = 128;

/** size-8000; numeric because react-resizable-panels treats numbers as pixels. */
export const SPAN_DETAILS_MIN_WIDTH_PIXELS = 640;

/** size-12000; the main detail column's factory target, not a user maximum. */
export const SPAN_DETAILS_FACTORY_WIDTH_PIXELS = 960;

/** size-15000; hard maximum for the main detail column and its drawer allocation. */
export const SPAN_DETAILS_MAX_WIDTH_PIXELS = 1200;

/** size-10; width of the compact separator between the trace columns. */
export const TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS = 1;

/** Smallest drawer that can preserve both columns' non-negotiable minimums. */
export const TRACE_DETAILS_MIN_DRAWER_WIDTH_PIXELS =
  TRACE_TREE_COLLAPSED_WIDTH_PIXELS +
  TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS +
  SPAN_DETAILS_MIN_WIDTH_PIXELS;
