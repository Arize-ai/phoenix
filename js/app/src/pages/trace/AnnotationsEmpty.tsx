import {
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";

export function AnnotationsEmpty({
  description = "No annotations for this span",
}: {
  description?: string;
} = {}) {
  return (
    <EmptyStateArea>
      <EmptyState
        graphic={<EmptyStateGraphic variant="annotation" />}
        description={description}
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
