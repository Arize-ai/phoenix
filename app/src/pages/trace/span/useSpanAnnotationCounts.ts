import { graphql, useLazyLoadQuery } from "react-relay";

import { NOTE_ANNOTATION_NAME } from "@phoenix/constants/annotationConstants";

import type { useSpanAnnotationCountsQuery } from "./__generated__/useSpanAnnotationCountsQuery.graphql";

/**
 * How many annotations and how many notes a span carries, for the cards that
 * show each count in their header while they are still closed.
 *
 * Notes are annotations under a reserved name, and each card counts only what
 * its own table shows, so the split is made here rather than at either card.
 *
 * Suspends, but rarely in practice: the span details query already pulls these
 * annotations in for the aside, so this resolves from the store without a
 * request.
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
