import React, { Suspense } from "react";
import { graphql, useFragment } from "react-relay";
import { PanelGroup } from "react-resizable-panels";
import { css } from "@emotion/react";

import { View } from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import { SpanAnnotationsEditor } from "@phoenix/components/trace/SpanAnnotationsEditor";
import { SpanAsideAnnotationList_span$key } from "@phoenix/pages/trace/__generated__/SpanAsideAnnotationList_span.graphql";

import { SpanAside_span$key } from "./__generated__/SpanAside_span.graphql";
import { SpanNotesEditor, SpanNotesEditorSkeleton } from "./SpanNotesEditor";

const annotationListCSS = css`
  display: flex;
  width: 100%;
  flex-direction: row;
  gap: var(--ac-global-dimension-size-100);
  flex-wrap: wrap;
  align-items: flex-start;
`;

type SpanAsideProps = {
  span: SpanAside_span$key;
};

/**
 * A component that shows the details of a span that is supplementary to the main span details
 */
export function SpanAside(props: SpanAsideProps) {
  const data = useFragment<SpanAside_span$key>(
    graphql`
      fragment SpanAside_span on Span {
        id
        project {
          id
          ...AnnotationConfigListProjectAnnotationConfigFragment
          annotationConfigs {
            configs: edges {
              config: node {
                ... on Node {
                  id
                }
                ... on AnnotationConfigBase {
                  name
                  description
                  annotationType
                }
                ... on CategoricalAnnotationConfig {
                  values {
                    label
                    score
                  }
                }
                ... on ContinuousAnnotationConfig {
                  lowerBound
                  upperBound
                  optimizationDirection
                }
                ... on FreeformAnnotationConfig {
                  name
                }
              }
            }
          }
        }
        code: statusCode
        startTime
        endTime
        tokenCountTotal
        tokenCountPrompt
        tokenCountCompletion
        ...SpanAsideAnnotationList_span
      }
    `,
    props.span
  );

  return (
    <PanelGroup direction="vertical" autoSaveId="span-aside-layout">
      <Suspense>
        <SpanAsideAnnotationList span={data} />
      </Suspense>
      <TitledPanel
        resizable
        title="Edit annotations"
        panelProps={{ order: 2, minSize: 10 }}
      >
        <View height="100%" maxHeight="100%">
          <SpanAnnotationsEditor
            projectId={data.project.id}
            spanNodeId={data.id}
          />
        </View>
      </TitledPanel>
      <TitledPanel
        resizable
        title="Notes"
        panelProps={{ order: 3, minSize: 10 }}
      >
        <View height="100%" maxHeight="100%">
          <Suspense fallback={<SpanNotesEditorSkeleton />}>
            <SpanNotesEditor spanNodeId={data.id} />
          </Suspense>
        </View>
      </TitledPanel>
    </PanelGroup>
  );
}

function SpanAsideAnnotationList(props: {
  span: SpanAsideAnnotationList_span$key;
}) {
  const data = useFragment<SpanAsideAnnotationList_span$key>(
    graphql`
      fragment SpanAsideAnnotationList_span on Span {
        project {
          id
          annotationConfigs {
            configs: edges {
              config: node {
                ... on Node {
                  id
                }
                ... on AnnotationConfigBase {
                  name
                }
              }
            }
          }
        }
        spanAnnotationsWithoutNotes: spanAnnotations(
          filter: { exclude: { names: ["note"] } }
        ) {
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
  const hasAnnotationConfigByName =
    data.project.annotationConfigs.configs.reduce(
      (acc, config) => {
        acc[config.config.name!] = true;
        return acc;
      },
      {} as Record<string, boolean>
    );
  const annotations = data.spanAnnotationsWithoutNotes.filter(
    (annotation) => hasAnnotationConfigByName[annotation.name]
  );
  const hasAnnotations = annotations.length > 0;
  return (
    <TitledPanel
      title="Annotations"
      disabled={!hasAnnotations}
      panelProps={{
        order: 1,
        defaultSize: hasAnnotations ? 65 : 0,
        maxSize: hasAnnotations ? 65 : 0,
      }}
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
  );
}
