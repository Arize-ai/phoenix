import type { AnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/AnnotationSummaryGroup.graphql";
import { AnnotationSummaryGroupStacks } from "@phoenix/components/annotation/AnnotationSummaryGroup";

export function TraceHeaderRootSpanAnnotations({
  span,
}: {
  span: AnnotationSummaryGroup$key;
}) {
  return (
    <AnnotationSummaryGroupStacks
      span={span}
      includeTraceAnnotations
      renderEmptyState={() => null}
    />
  );
}
