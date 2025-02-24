import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, Text } from "../../components";
import {
  AnnotationLabel,
  AnnotationTooltip,
} from "../../components/annotation";

import { TraceHeaderSpanAnnotationsQuery } from "./__generated__/TraceHeaderSpanAnnotationsQuery.graphql";

export function TraceHeaderRootSpanAnnotations(id: string) {
  const data = useLazyLoadQuery<TraceHeaderSpanAnnotationsQuery>(
    graphql`
      query TraceHeaderSpanAnnotationsQuery($id: GlobalID!) {
        span: node(id: $id) {
          ... on Span {
            spanAnnotations {
              name
              label
              score
              annotatorKind
            }
          }
        }
      }
    `,
    { id },
    {
      fetchPolicy: "store-and-network",
    }
  );
  const spanAnnotations = data.span.spanAnnotations ?? [];
  const hasAnnotations = spanAnnotations.length > 0;
  return hasAnnotations ? (
    <Flex direction="column" gap="size-50">
      <Text elementType="h3" size="M" color="text-700">
        Feedback
      </Text>
      <Flex direction="row" gap="size-50">
        {spanAnnotations.map((annotation) => {
          return (
            <AnnotationTooltip key={annotation.name} annotation={annotation}>
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
