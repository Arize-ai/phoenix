import { Suspense, useMemo, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { graphql, useFragment } from "react-relay";
import { ImperativePanelHandle, PanelGroup } from "react-resizable-panels";
import { css } from "@emotion/react";

import { Flex, KeyboardToken, View } from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import {
  EDIT_ANNOTATION_HOTKEY,
  SpanAnnotationsEditor,
} from "@phoenix/components/trace/SpanAnnotationsEditor";
import { SpanAsideAnnotationList_span$key } from "@phoenix/pages/trace/__generated__/SpanAsideAnnotationList_span.graphql";
import { deduplicateAnnotationsByName } from "@phoenix/pages/trace/utils";

import { SpanAside_span$key } from "./__generated__/SpanAside_span.graphql";
import {
  NOTE_HOTKEY,
  SpanNotesEditor,
  SpanNotesEditorSkeleton,
} from "./SpanNotesEditor";

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
      fragment SpanAside_span on Span
      @argumentDefinitions(filterUserIds: { type: "[ID]" }) {
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
        ...TraceHeaderRootSpanAnnotationsFragment
        ...SpanAsideAnnotationList_span
          @arguments(filterUserIds: $filterUserIds)
      }
    `,
    props.span
  );

  const editAnnotationsPanelRef = useRef<ImperativePanelHandle>(null);
  const notesPanelRef = useRef<ImperativePanelHandle>(null);
  useHotkeys(EDIT_ANNOTATION_HOTKEY, () => {
    // open the span annotations editor if it is closed
    if (
      editAnnotationsPanelRef.current &&
      editAnnotationsPanelRef.current.isCollapsed()
    ) {
      editAnnotationsPanelRef.current.expand(50);
    }
  });
  useHotkeys(NOTE_HOTKEY, () => {
    // open the span notes editor if it is closed
    if (notesPanelRef.current && notesPanelRef.current.isCollapsed()) {
      notesPanelRef.current.expand(50);
    }
  });

  return (
    <PanelGroup direction="vertical" autoSaveId="span-aside-layout">
      <Suspense>
        <SpanAsideAnnotationList span={data} />
      </Suspense>
      <TitledPanel
        ref={editAnnotationsPanelRef}
        resizable
        title={
          <Flex direction={"row"} gap="size-100" alignItems={"center"}>
            <span>Edit Annotations</span>
            <KeyboardToken>{EDIT_ANNOTATION_HOTKEY}</KeyboardToken>
          </Flex>
        }
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
        ref={notesPanelRef}
        resizable
        title={
          <Flex direction={"row"} gap="size-100" alignItems={"center"}>
            <span>Notes</span>
            <KeyboardToken>{NOTE_HOTKEY}</KeyboardToken>
          </Flex>
        }
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
      fragment SpanAsideAnnotationList_span on Span
      @argumentDefinitions(filterUserIds: { type: "[ID]" }) {
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
        filteredSpanAnnotations: spanAnnotations(
          filter: {
            exclude: { names: ["note"] }
            include: { userIds: $filterUserIds }
          }
        ) {
          id
          name
          annotatorKind
          score
          label
          explanation
          createdAt
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
  const filteredSpanAnnotations = data.filteredSpanAnnotations;
  const annotations = useMemo(
    () =>
      deduplicateAnnotationsByName(
        filteredSpanAnnotations.filter(
          (annotation) => hasAnnotationConfigByName[annotation.name]
        )
      ),
    [filteredSpanAnnotations, hasAnnotationConfigByName]
  );
  const hasAnnotations = annotations.length > 0;
  return (
    <TitledPanel
      title="My Annotations"
      disabled={!hasAnnotations}
      panelProps={{
        order: 1,
        defaultSize: hasAnnotations ? 20 : 0,
        minSize: hasAnnotations ? 20 : 0,
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
