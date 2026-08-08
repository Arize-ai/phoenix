import { useEffect, useRef, useState } from "react";
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
import { useSpanAsideOpenRequest } from "./SpanAsideContext";

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
      }
    `,
    props.span
  );

  // the button that adds a config and the list that shows them are in
  // different subtrees, so the key they share lives above both
  const [annotationConfigsRefetchKey, setAnnotationConfigsRefetchKey] =
    useState(0);
  const setIsAnnotatingSpans = usePreferencesContext(
    (state) => state.setIsAnnotatingSpans
  );
  const editAnnotationsPanelRef = useRef<PanelImperativeHandle>(null);
  // this component owns the section panel, so it does the expanding
  const openRequest = useSpanAsideOpenRequest();
  useEffect(() => {
    if (openRequest == null) {
      return;
    }
    if (editAnnotationsPanelRef.current?.isCollapsed()) {
      editAnnotationsPanelRef.current.expand();
    }
  }, [openRequest]);

  return (
    <Group orientation="vertical">
      <TitledPanel
        ref={editAnnotationsPanelRef}
        resizable
        title="Edit Annotations"
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            <NewAnnotationButton
              // the button holds state about the span, so start it over when
              // the span changes
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
    </Group>
  );
}
