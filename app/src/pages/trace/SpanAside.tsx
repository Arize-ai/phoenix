import { Suspense, useRef } from "react";
import { FocusScope } from "react-aria";
import { useHotkeys } from "react-hotkeys-hook";
import { graphql, useFragment } from "react-relay";
import { ImperativePanelHandle, PanelGroup } from "react-resizable-panels";

import { Flex, KeyboardToken, View } from "@phoenix/components";
import { AnnotationSummaryGroupTokens } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import { FocusHotkey } from "@phoenix/components/FocusHotkey";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import {
  EDIT_ANNOTATION_HOTKEY,
  SpanAnnotationsEditor,
} from "@phoenix/components/trace/SpanAnnotationsEditor";
import { SpanAsideAnnotationList_span$key } from "@phoenix/pages/trace/__generated__/SpanAsideAnnotationList_span.graphql";

import { SpanAside_span$key } from "./__generated__/SpanAside_span.graphql";
import {
  NOTE_HOTKEY,
  SpanNotesEditor,
  SpanNotesEditorSkeleton,
} from "./SpanNotesEditor";

const SPAN_ANNOTATION_LIST_HOTKEY = "s";

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
        ...TraceHeaderRootSpanAnnotationsFragment
        ...SpanAsideAnnotationList_span
        ...AnnotationSummaryGroup
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
            // remount the editor when the span id changes
            // some components are uncontrolled and will not update by themselves when the span id changes
            key={data.id}
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
        <View height="100%" maxHeight="100%" padding="size-100">
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
        spanAnnotations {
          id
        }
        ...AnnotationSummaryGroup
      }
    `,
    props.span
  );
  const annotationListPanelRef = useRef<ImperativePanelHandle>(null);
  useHotkeys(SPAN_ANNOTATION_LIST_HOTKEY, () => {
    if (
      annotationListPanelRef.current &&
      annotationListPanelRef.current.isCollapsed()
    ) {
      annotationListPanelRef.current.expand(50);
    }
  });
  const hasAnnotations = data.spanAnnotations.length > 0;
  return (
    <TitledPanel
      ref={annotationListPanelRef}
      title={
        <Flex direction={"row"} gap="size-100" alignItems={"center"}>
          <span>Annotation Summary</span>
          <KeyboardToken>{SPAN_ANNOTATION_LIST_HOTKEY}</KeyboardToken>
        </Flex>
      }
      disabled={!hasAnnotations}
      panelProps={{
        order: 1,
        defaultSize: hasAnnotations ? 20 : 0,
        minSize: hasAnnotations ? 20 : 0,
      }}
    >
      <FocusScope>
        <FocusHotkey hotkey={SPAN_ANNOTATION_LIST_HOTKEY} />
        <View
          paddingY="size-200"
          paddingX="size-200"
          overflow="auto"
          maxHeight="100%"
        >
          <AnnotationSummaryGroupTokens span={data} />
        </View>
      </FocusScope>
    </TitledPanel>
  );
}
