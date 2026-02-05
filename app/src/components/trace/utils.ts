import { ISpanItem } from "./types";

export type SpanTreeNode<TSpan> = {
  span: TSpan;
  children: SpanTreeNode<TSpan>[];
};

/**
 * Compare two ISO 8601 timestamp strings with sub-millisecond precision.
 *
 * Handles timestamps with different timezone offsets by using Date for conversion.
 * Preserves sub-millisecond precision by comparing fractional seconds as floats.
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
      compareTimestamps(a.span.startTime, b.span.startTime)
    );
  }
  rootSpans.sort((a, b) =>
    compareTimestamps(a.span.startTime, b.span.startTime)
  );
  return rootSpans;
}
