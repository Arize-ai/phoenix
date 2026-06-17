import { EmptyState, EmptyStateGraphic } from "@phoenix/components/empty-state";

export function SpanAnnotationsEmpty() {
  return (
    <EmptyState
      graphic={<EmptyStateGraphic variant="annotation" />}
      description="No annotations for this span"
      action={{
        type: "strip",
        items: [
          {
            kind: "link",
            label: "How to Annotate",
            href: "https://arize.com/docs/phoenix/tracing/how-to-tracing/feedback-and-annotations/annotating-in-the-ui",
          },
        ],
      }}
    />
  );
}
