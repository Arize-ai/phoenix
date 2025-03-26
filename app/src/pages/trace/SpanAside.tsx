import React, { PropsWithChildren } from "react";
import { graphql, useRefetchableFragment } from "react-relay";
import { css } from "@emotion/react";

import { Flex, Text, View } from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";

import { SpanAside_span$key } from "./__generated__/SpanAside_span.graphql";
import { SpanAsideSpanQuery } from "./__generated__/SpanAsideSpanQuery.graphql";

const annotationListCSS = css`
  display: flex;
  padding-top: var(--ac-global-dimension-size-50);
  flex-direction: column;
  gap: var(--ac-global-dimension-size-100);
  align-items: flex-start;
`;

/**
 * A component that shows the details of a span that is supplementary to the main span details
 */
export function SpanAside(props: { span: SpanAside_span$key }) {
  const [data] = useRefetchableFragment<SpanAsideSpanQuery, SpanAside_span$key>(
    graphql`
      fragment SpanAside_span on Span
      @refetchable(queryName: "SpanAsideSpanQuery") {
        id
        code: statusCode
        startTime
        endTime
        tokenCountTotal
        tokenCountPrompt
        tokenCountCompletion
        spanAnnotations {
          id
          name
          label
          annotatorKind
          score
        }
      }
    `,
    props.span
  );
  const annotations = data.spanAnnotations;
  const hasAnnotations = annotations.length > 0;
  return (
    <View padding="size-200" width="100%" flex="none" minHeight="100%">
      <Flex direction="column" gap="size-200">
        <LabeledValue label="Feedback">
          {hasAnnotations ? (
            <ul css={annotationListCSS}>
              {annotations.map((annotation) => (
                <li key={annotation.id}>
                  <AnnotationLabel
                    annotation={annotation}
                    annotationDisplayPreference="label"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <View padding="size-200">
              <Flex direction="row" alignItems="center" justifyContent="center">
                <Text color="text-300">No Annotations</Text>
              </Flex>
            </View>
          )}
        </LabeledValue>
      </Flex>
    </View>
  );
}

function LabeledValue({
  label,
  children,
}: PropsWithChildren<{ label: string }>) {
  return (
    <Flex direction="column">
      <Text elementType="h3" size="S" color="text-700">
        {label}
      </Text>
      {children}
    </Flex>
  );
}
