import React from "react";
import { graphql, useRefetchableFragment } from "react-relay";
import { PanelGroup } from "react-resizable-panels";
import { css } from "@emotion/react";

import { View } from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
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
    <PanelGroup direction="vertical" autoSaveId="span-aside-layout">
      {hasAnnotations && (
        <TitledPanel
          title="Annotations"
          panelProps={{ order: 1, defaultSize: 65 }}
        >
          <View paddingY="size-100" paddingX="size-100">
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
        </TitledPanel>
      )}
      <TitledPanel resizable title="Edit annotations" panelProps={{ order: 2 }}>
        <View height="100%" maxHeight="100%">
          <SpanAnnotationsEditor
            projectId={data.project.id}
            spanNodeId={data.id}
          />
        </View>
      </TitledPanel>
    </PanelGroup>
  );
}
