import { ISpanItem } from "./types";

export type SpanTreeNode<TSpan> = {
  span: TSpan;
  children: SpanTreeNode<TSpan>[];
};

/**
 * Compare two ISO 8601 timestamp strings.
 * Uses string comparison which correctly handles microsecond precision
 * (JavaScript Date only has millisecond precision, which is an
 * issue when sorting spans of sub-millisecond duration).
 */
function compareStartTimes(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Create a span tree from a list of spans
 * @param spans
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
      compareStartTimes(a.span.startTime, b.span.startTime)
    );
  }
  rootSpans.sort((a, b) =>
    compareStartTimes(a.span.startTime, b.span.startTime)
  );
  return rootSpans;
}
