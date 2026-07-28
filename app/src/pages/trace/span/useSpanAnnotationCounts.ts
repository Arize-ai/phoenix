import { graphql, useLazyLoadQuery } from "react-relay";

import { NOTE_ANNOTATION_NAME } from "@phoenix/constants/annotationConstants";

import type { useSpanAnnotationCountsQuery } from "./__generated__/useSpanAnnotationCountsQuery.graphql";

/**
 * How many annotations and how many notes a span carries. Notes are annotations
 * under a reserved name, so `annotationCount` excludes them.
 *
 * Suspends, but rarely: the span details query usually has these in the store.
 */
export function useSpanAnnotationCounts({
  spanNodeId,
}: {
  spanNodeId: string;
}): { annotationCount: number; noteCount: number } {
  const data = useLazyLoadQuery<useSpanAnnotationCountsQuery>(
    graphql`
      query useSpanAnnotationCountsQuery($id: ID!) {
        span: node(id: $id) {
          ... on Span {
            spanAnnotations {
              id
              name
            }
          }
        }
      }
    `,
    { id: spanNodeId },
    { fetchPolicy: "store-or-network" }
  );
  const annotations = data.span?.spanAnnotations ?? [];
  const noteCount = annotations.filter(
    (annotation) => annotation.name === NOTE_ANNOTATION_NAME
  ).length;
  return { annotationCount: annotations.length - noteCount, noteCount };
}
