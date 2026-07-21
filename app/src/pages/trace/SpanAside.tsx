import { Suspense, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { graphql, useFragment } from "react-relay";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { Group } from "react-resizable-panels";

import {
  Flex,
  Icon,
  IconButton,
  Icons,
  KeyboardToken,
  View,
} from "@phoenix/components";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import { SpanAnnotationsEditor } from "@phoenix/components/trace/SpanAnnotationsEditor";
import { EDIT_ANNOTATION_HOTKEY } from "@phoenix/constants/annotationConstants";

import type { SpanAside_span$key } from "./__generated__/SpanAside_span.graphql";
import {
  NOTE_HOTKEY,
  SpanNotesEditor,
  SpanNotesEditorSkeleton,
} from "./SpanNotesEditor";

type SpanAsideProps = {
  span: SpanAside_span$key;
  /**
   * Called when the user dismisses the aside
   */
  onClose?: () => void;
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
                  optimizationDirection
                  threshold
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
      }
    `,
    props.span
  );

  const editAnnotationsPanelRef = useRef<PanelImperativeHandle>(null);
  const notesPanelRef = useRef<PanelImperativeHandle>(null);
  useHotkeys(EDIT_ANNOTATION_HOTKEY, () => {
    // open the span annotations editor if it is closed
    if (
      editAnnotationsPanelRef.current &&
      editAnnotationsPanelRef.current.isCollapsed()
    ) {
      editAnnotationsPanelRef.current.expand();
    }
  });
  useHotkeys(NOTE_HOTKEY, () => {
    // open the span notes editor if it is closed
    if (notesPanelRef.current && notesPanelRef.current.isCollapsed()) {
      notesPanelRef.current.expand();
    }
  });

  return (
    <Group orientation="vertical">
      <TitledPanel
        ref={editAnnotationsPanelRef}
        title={
          <Flex direction={"row"} gap="size-100" alignItems={"center"}>
            <span>Edit Annotations</span>
            <KeyboardToken>{EDIT_ANNOTATION_HOTKEY}</KeyboardToken>
          </Flex>
        }
        extra={
          props.onClose ? (
            <IconButton
              size="S"
              aria-label="Close annotations"
              onPress={props.onClose}
            >
              <Icon svg={<Icons.Close />} />
            </IconButton>
          ) : null
        }
        panelProps={{ minSize: "10%" }}
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
        panelProps={{ minSize: "10%" }}
      >
        <View height="100%" maxHeight="100%" padding="size-100">
          <Suspense fallback={<SpanNotesEditorSkeleton />}>
            <SpanNotesEditor spanNodeId={data.id} />
          </Suspense>
        </View>
      </TitledPanel>
    </Group>
  );
}
