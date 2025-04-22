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
  const spanAnnotationSummariesByAnnotationName =
    span.spanAnnotationSummaries?.reduce(
      (acc, summary) => {
        acc[summary.name] = summary;
        return acc;
      },
      {} as Record<string, (typeof span.spanAnnotationSummaries)[number]>
    ) ?? {};
  const spanAnnotations = span.spanAnnotations ?? [];
  const hasAnnotations = spanAnnotations.length > 0;
  return hasAnnotations ? (
    <Flex direction="column" gap="size-50">
      <Flex direction="row" gap="size-200">
        {spanAnnotations.map((annotation) => {
          return (
            <AnnotationTooltip key={annotation.id} annotation={annotation}>
              <Summary name={annotation.name}>
                <SummaryValue
                  name={annotation.name}
                  meanScore={
                    spanAnnotationSummariesByAnnotationName[annotation.name]
                      ?.meanScore
                  }
                  labelFractions={
                    spanAnnotationSummariesByAnnotationName[annotation.name]
                      ?.labelFractions
                  }
                />
              </Summary>
            </AnnotationTooltip>
          );
        })}
      </Flex>
    </Flex>
  ) : null;
}
