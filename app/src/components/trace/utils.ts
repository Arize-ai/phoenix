import { ISpanItem } from "./types";

export type SpanTreeNode<TSpan> = {
  span: TSpan;
  children: SpanTreeNode<TSpan>[];
};
/**
 * Create a span tree from a list of spans
 * @param spans
 */
export function createSpanTree<TSpan extends ISpanItem>(
  spans: TSpan[]
): SpanTreeNode<TSpan>[] {
  // A map of spanId to span tree node
  const spanMap = spans.reduce((acc, span) => {
    acc.set(span.context.spanId, {
      span,
      children: [],
    });
    return acc;
  }, new Map<string, SpanTreeNode<TSpan>>());
  const rootSpans: SpanTreeNode<TSpan>[] = [];
  for (const span of spans) {
    const spanTreeItem = spanMap.get(span.context.spanId);
    if (span.parentId === null || !spanMap.has(span.parentId)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      rootSpans.push(spanTreeItem!);
    } else {
      const parentSpanNode = spanMap.get(span.parentId);
      if (parentSpanNode) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        parentSpanNode.children.push(spanTreeItem!);
      }
    }
  }
  // We must sort the children of each span by their start time
  // So that the children are in the correct order
  for (const spanNode of spanMap.values()) {
    spanNode.children.sort(
      (a, b) =>
        new Date(a.span.startTime).valueOf() -
        new Date(b.span.startTime).valueOf()
    );
  }
  return rootSpans;
}
