import type { ISpanItem } from "./types";

/**
 * Tree node used by trace tree renderers.
 *
 * @typeParam TSpan - Span shape stored in the tree. Must include the span
 * fields needed by the caller, and is commonly constrained to `ISpanItem`.
 */
export type SpanTreeNode<TSpan> = {
  /** Span represented by this node. */
  span: TSpan;

  /** Child spans whose `parentId` points to this node's `spanId`. */
  children: SpanTreeNode<TSpan>[];
};

/**
 * Compare two ISO 8601 timestamp strings with sub-millisecond precision.
 *
 * @remarks
 * JavaScript `Date` normalizes timezone offsets but only preserves millisecond
 * precision. When two timestamps normalize to the same millisecond, this
 * comparator falls back to fractional-second comparison so traces with
 * microsecond/nanosecond timestamps render in their original order.
 *
 * @param a - First ISO 8601 timestamp string.
 * @param b - Second ISO 8601 timestamp string.
 * @returns `-1` when `a` is earlier, `1` when `a` is later, and `0` when the
 * timestamps are equal at their represented precision.
 */
export function compareTimestamps(a: string, b: string): number {
  const dateA = new Date(a);
  const dateB = new Date(b);

  if (dateA.getTime() === dateB.getTime()) {
    // Dates are equal at millisecond precision, compare fractional seconds
    const fracA = parseFloat("0." + (a.match(/\.(\d+)/)?.[1] || "0"));
    const fracB = parseFloat("0." + (b.match(/\.(\d+)/)?.[1] || "0"));
    return Math.sign(fracA - fracB);
  }

  return Math.sign(dateA.getTime() - dateB.getTime());
}

/**
 * Creates a chronologically sorted tree from a flat list of spans.
 *
 * @remarks
 * Parent/child relationships are built from `spanId` and `parentId`. Spans with
 * `parentId === null` become roots. Spans whose parent is absent from the input
 * are also treated as roots so partially loaded traces still render instead of
 * dropping orphaned spans.
 *
 * Root spans and each node's children are sorted by `startTime` using
 * {@link compareTimestamps}, preserving sub-millisecond ordering.
 *
 * @typeParam TSpan - Span item type retained on each tree node.
 * @param spans - Flat span list from a single trace or trace-like collection.
 * @returns Root span nodes, each with recursively populated `children`.
 */
export function createSpanTree<TSpan extends ISpanItem>(
  spans: TSpan[]
): SpanTreeNode<TSpan>[] {
  // A map of spanId to span tree node
  const spanMap = spans.reduce((acc, span) => {
    acc.set(span.spanId, {
      span,
      children: [],
    });
    return acc;
  }, new Map<string, SpanTreeNode<TSpan>>());
  const rootSpans: SpanTreeNode<TSpan>[] = [];
  for (const span of spans) {
    const spanTreeItem = spanMap.get(span.spanId);
    if (span.parentId === null || !spanMap.has(span.parentId)) {
      rootSpans.push(spanTreeItem!);
    } else {
      const parentSpanNode = spanMap.get(span.parentId);
      if (parentSpanNode) {
        parentSpanNode.children.push(spanTreeItem!);
      }
    }
  }
  // We must sort the children of each span by their start time
  // So that the children are in the correct order
  for (const spanNode of spanMap.values()) {
    spanNode.children.sort((a, b) =>
      compareTimestamps(a.span.startTime, b.span.startTime)
    );
  }
  rootSpans.sort((a, b) =>
    compareTimestamps(a.span.startTime, b.span.startTime)
  );
  return rootSpans;
}

/**
 * Checks whether a span should be included for a normalized search query.
 *
 * @param span - Span to inspect.
 * @param normalizedQuery - Lowercase, trimmed search query.
 * @returns `true` when the query appears in the span name, kind, status, Relay
 * node id, or OpenTelemetry span id.
 */
function spanMatchesSearchQuery(span: ISpanItem, normalizedQuery: string) {
  return [span.name, span.spanKind, span.statusCode, span.id, span.spanId].some(
    (value) => value.toLowerCase().includes(normalizedQuery)
  );
}

/**
 * Filters a single span tree node while retaining matching descendants.
 *
 * @remarks
 * A node is retained when it directly matches the query or when at least one of
 * its descendants matches. In the descendant case, the returned node preserves
 * ancestor context but contains only the filtered child branches.
 *
 * @typeParam TSpan - Span item type retained on each tree node.
 * @param node - Node to filter.
 * @param normalizedQuery - Lowercase, trimmed search query.
 * @returns A filtered copy of `node`, or `null` when neither it nor any
 * descendant matches.
 */
function filterSpanTreeNode<TSpan extends ISpanItem>(
  node: SpanTreeNode<TSpan>,
  normalizedQuery: string
): SpanTreeNode<TSpan> | null {
  const children = node.children.flatMap((childNode) => {
    const filteredChildNode = filterSpanTreeNode(childNode, normalizedQuery);
    return filteredChildNode ? [filteredChildNode] : [];
  });
  if (spanMatchesSearchQuery(node.span, normalizedQuery) || children.length) {
    return {
      span: node.span,
      children,
    };
  }
  return null;
}

/**
 * Filter a span tree to matching spans while preserving ancestor context.
 *
 * @remarks
 * Search is case-insensitive and matches span name, kind, status, Relay node
 * id, and OpenTelemetry span id. Ancestors of matching spans are kept so the UI
 * can show how a matching span fits into the trace. Empty or whitespace-only
 * queries return the original tree reference to avoid unnecessary re-rendering.
 *
 * @typeParam TSpan - Span item type retained on each tree node.
 * @param spanTree - Root nodes to filter.
 * @param searchQuery - Raw search text from the trace tree search field.
 * @returns Filtered root nodes. Returns `spanTree` unchanged for an empty query.
 */
export function filterSpanTree<TSpan extends ISpanItem>(
  spanTree: SpanTreeNode<TSpan>[],
  searchQuery: string
): SpanTreeNode<TSpan>[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return spanTree;
  }
  return spanTree.flatMap((node) => {
    const filteredNode = filterSpanTreeNode(node, normalizedQuery);
    return filteredNode ? [filteredNode] : [];
  });
}
