import {
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";

export function SpanAnnotationsEmpty() {
  return (
    <EmptyStateArea>
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
    </EmptyStateArea>
  );
}
