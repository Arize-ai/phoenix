import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, Text } from "../../components";
import {
  AnnotationLabel,
  AnnotationTooltip,
} from "../../components/annotation";

import { TraceHeaderRootSpanAnnotationsQuery } from "./__generated__/TraceHeaderRootSpanAnnotationsQuery.graphql";

export function TraceHeaderRootSpanAnnotations({ spanId }: { spanId: string }) {
  const data = useLazyLoadQuery<TraceHeaderRootSpanAnnotationsQuery>(
    graphql`
      query TraceHeaderRootSpanAnnotationsQuery($spanId: GlobalID!) {
        span: node(id: $spanId) {
          ... on Span {
            spanAnnotations {
              id
              name
              label
              score
              annotatorKind
            }
          }
        }
      }
    `,
    { spanId },
    {
      fetchPolicy: "store-and-network",
    }
  );
  const spanAnnotations = data.span.spanAnnotations ?? [];
  const hasAnnotations = spanAnnotations.length > 0;
  return hasAnnotations ? (
    <Flex direction="column" gap="size-50">
      <Text elementType="h3" size="S" color="text-700">
        Feedback
      </Text>
      <Flex direction="row" gap="size-50">
        {spanAnnotations.map((annotation) => {
          return (
            <AnnotationTooltip key={annotation.id} annotation={annotation}>
              <AnnotationLabel
                annotation={annotation}
                annotationDisplayPreference="label"
              />
            </AnnotationTooltip>
          );
        })}
      </Flex>
    </Flex>
  ) : null;
}
