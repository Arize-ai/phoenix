import React from "react";
import { graphql, useFragment, useLazyLoadQuery } from "react-relay";

import {
  Summary,
  SummaryValue,
} from "@phoenix/pages/project/AnnotationSummary";
import { TraceHeaderRootSpanAnnotationsFragment$key } from "@phoenix/pages/trace/__generated__/TraceHeaderRootSpanAnnotationsFragment.graphql";

import { Flex } from "../../components";
import { AnnotationTooltip } from "../../components/annotation";

import { TraceHeaderRootSpanAnnotationsQuery } from "./__generated__/TraceHeaderRootSpanAnnotationsQuery.graphql";

export function TraceHeaderRootSpanAnnotations({ spanId }: { spanId: string }) {
  const query = useLazyLoadQuery<TraceHeaderRootSpanAnnotationsQuery>(
    graphql`
      query TraceHeaderRootSpanAnnotationsQuery($spanId: GlobalID!) {
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
        spanAnnotations {
          id
          name
          label
          score
          annotatorKind
          createdAt
        }
        spanAnnotationSummaries {
          name
          labelFractions {
            fraction
            label
          }
          meanScore
        }
      }
    `,
    query.span
  );
  const spanAnnotations = span.spanAnnotations ?? [];
  const latestSpanAnnotationByName = spanAnnotations.reduce(
    (acc, annotation) => {
      if (!acc[annotation.name]) {
        acc[annotation.name] = annotation;
      } else if (
        new Date(annotation.createdAt) >
        new Date(acc[annotation.name].createdAt)
      ) {
        acc[annotation.name] = annotation;
      }
      return acc;
    },
    {} as Record<string, (typeof spanAnnotations)[number]>
  );
  const hasAnnotations = spanAnnotations.length > 0;
  return hasAnnotations ? (
    <Flex direction="column" gap="size-50">
      <Flex direction="row" gap="size-200">
        {span.spanAnnotationSummaries.map((summary) => {
          const latestAnnotation = latestSpanAnnotationByName[summary.name];
          return (
            <AnnotationTooltip
              key={latestAnnotation.id}
              annotation={latestAnnotation}
            >
              <Summary name={latestAnnotation.name}>
                <SummaryValue
                  name={latestAnnotation.name}
                  meanScore={summary.meanScore}
                  labelFractions={summary.labelFractions}
                />
              </Summary>
            </AnnotationTooltip>
          );
        })}
      </Flex>
    </Flex>
  ) : null;
}
