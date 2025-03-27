import React from "react";
import { graphql, useRefetchableFragment } from "react-relay";
import { css } from "@emotion/react";

import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  View,
} from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { SpanAnnotationsEditor } from "@phoenix/components/trace/SpanAnnotationsEditor";

import { SpanAside_span$key } from "./__generated__/SpanAside_span.graphql";
import { SpanAsideSpanQuery } from "./__generated__/SpanAsideSpanQuery.graphql";

const annotationListCSS = css`
  display: flex;
  width: 100%;
  flex-direction: row;
  gap: var(--ac-global-dimension-size-100);
  flex-wrap: wrap;
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
        project {
          id
        }
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
    <Flex direction="column" flex="1 1 auto" height="100%">
      {hasAnnotations && (
        <Flex flexShrink={1}>
          <View padding="size-200">
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
          </View>
        </Flex>
      )}
      <DisclosureGroup
        css={css`
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          height: 1px;

          .ac-disclosure {
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            height: 1px;
          }

          .ac-disclosure-panel {
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            height: 1px;
          }
        `}
      >
        <Disclosure
          id="edit-annotations"
          css={css`
            border-top: 1px solid var(--ac-global-border-color-default);

            .ac-disclosure-trigger {
              width: 100%;
            }
          `}
        >
          <DisclosureTrigger>Edit annotations</DisclosureTrigger>
          <DisclosurePanel>
            <SpanAnnotationsEditor
              projectId={data.project.id}
              spanNodeId={data.id}
            />
          </DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    </Flex>
  );
}
