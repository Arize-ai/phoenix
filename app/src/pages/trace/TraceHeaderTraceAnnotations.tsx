import { graphql, useFragment, useLazyLoadQuery } from "react-relay";

import { TraceAnnotationSummaryGroupStacks } from "@phoenix/components/annotation/TraceAnnotationSummaryGroup";
import type { TraceHeaderTraceAnnotationsFragment$key } from "@phoenix/pages/trace/__generated__/TraceHeaderTraceAnnotationsFragment.graphql";

import type { TraceHeaderTraceAnnotationsQuery } from "./__generated__/TraceHeaderTraceAnnotationsQuery.graphql";

export function TraceHeaderTraceAnnotations({ traceId }: { traceId: string }) {
  const query = useLazyLoadQuery<TraceHeaderTraceAnnotationsQuery>(
    graphql`
      query TraceHeaderTraceAnnotationsQuery($traceId: ID!) {
        trace: node(id: $traceId) {
          ... on Trace {
            ...TraceHeaderTraceAnnotationsFragment
          }
        }
      }
    `,
    { traceId },
    {
      fetchPolicy: "store-and-network",
    }
  );
  const trace = useFragment<TraceHeaderTraceAnnotationsFragment$key>(
    graphql`
      fragment TraceHeaderTraceAnnotationsFragment on Trace {
        ...TraceAnnotationSummaryGroup
      }
    `,
    query.trace
  );
  return (
    <TraceAnnotationSummaryGroupStacks
      trace={trace}
      leadingDivider
      renderEmptyState={() => null}
    />
  );
}
