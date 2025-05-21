import { graphql, useFragment, useLazyLoadQuery } from "react-relay";

import { AnnotationSummaryGroupStacks } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import { TraceHeaderRootSpanAnnotationsFragment$key } from "@phoenix/pages/trace/__generated__/TraceHeaderRootSpanAnnotationsFragment.graphql";

import { TraceHeaderRootSpanAnnotationsQuery } from "./__generated__/TraceHeaderRootSpanAnnotationsQuery.graphql";

export function TraceHeaderRootSpanAnnotations({ spanId }: { spanId: string }) {
  const query = useLazyLoadQuery<TraceHeaderRootSpanAnnotationsQuery>(
    graphql`
      query TraceHeaderRootSpanAnnotationsQuery($spanId: ID!) {
        span: node(id: $spanId) {
          ... on Span {
            ...TraceHeaderRootSpanAnnotationsFragment
          }
        }
      }
    `,
    { spanId },
    {
      fetchPolicy: "store-and-network",
    }
  );
  const span = useFragment<TraceHeaderRootSpanAnnotationsFragment$key>(
    graphql`
      fragment TraceHeaderRootSpanAnnotationsFragment on Span {
        ...AnnotationSummaryGroup
      }
    `,
    query.span
  );
  return (
    <AnnotationSummaryGroupStacks span={span} renderEmptyState={() => null} />
  );
}
