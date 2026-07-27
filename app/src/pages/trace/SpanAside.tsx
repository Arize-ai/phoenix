import { Suspense, useEffect, useRef, useState } from "react";
import { graphql, useFragment } from "react-relay";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { Group } from "react-resizable-panels";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import {
  NewAnnotationButton,
  SpanAnnotationsEditor,
} from "@phoenix/components/trace/SpanAnnotationsEditor";
import { usePreferencesContext } from "@phoenix/contexts";

import type { SpanAside_span$key } from "./__generated__/SpanAside_span.graphql";
import { useSpanAnnotationEditorOpenRequest } from "./SpanAnnotationEditorContext";
import { SpanNotesEditor, SpanNotesEditorSkeleton } from "./SpanNotesEditor";

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

  // the button that adds an annotation config sits in the section header, the
  // list that shows them in the panel below, so the key they share lives here
  const [annotationConfigsRefetchKey, setAnnotationConfigsRefetchKey] =
    useState(0);
  const setIsAnnotatingSpans = usePreferencesContext(
    (state) => state.setIsAnnotatingSpans
  );
  const editAnnotationsPanelRef = useRef<PanelImperativeHandle>(null);
  const notesPanelRef = useRef<PanelImperativeHandle>(null);
  // Whoever asked for a section — a hotkey, a button in one of the info cards —
  // opened the aside by setting the preference. Only the aside can open the
  // section itself, so a reader who had collapsed it still lands on a composer.
  const openRequest = useSpanAnnotationEditorOpenRequest();
  useEffect(() => {
    if (openRequest == null) {
      return;
    }
    const panelRef =
      openRequest.section === "notes" ? notesPanelRef : editAnnotationsPanelRef;
    if (panelRef.current?.isCollapsed()) {
      panelRef.current.expand();
    }
  }, [openRequest]);

  return (
    <Group orientation="vertical">
      <TitledPanel
        ref={editAnnotationsPanelRef}
        resizable
        title="Edit Annotations"
        // the section's own controls: add an annotation, and close the aside
        // this all sits in
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            <NewAnnotationButton
              // some of the button's state is about the span being annotated,
              // so it starts over when the span does
              key={data.id}
              projectId={data.project.id}
              spanNodeId={data.id}
              refetchKey={annotationConfigsRefetchKey}
              onRefetchKeyChange={setAnnotationConfigsRefetchKey}
            />
            <TooltipTrigger>
              <Button
                size="S"
                variant="quiet"
                aria-label="Close annotations"
                leadingVisual={<Icon svg={<Icons.Close />} />}
                onPress={() => setIsAnnotatingSpans(false)}
              />
              <Tooltip offset={1}>Close annotations</Tooltip>
            </TooltipTrigger>
          </Flex>
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
            annotationConfigsRefetchKey={annotationConfigsRefetchKey}
          />
        </View>
      </TitledPanel>
      <TitledPanel
        ref={notesPanelRef}
        resizable
        // the hotkey is named in the tooltip of the button that opens this,
        // the same as the annotations section above
        title="Notes"
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
