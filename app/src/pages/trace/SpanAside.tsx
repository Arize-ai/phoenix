import React, {
  forwardRef,
  PropsWithChildren,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { graphql, useRefetchableFragment } from "react-relay";
import {
  ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, View } from "@phoenix/components";
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
    <PanelGroup direction="vertical">
      {hasAnnotations && (
        <Panel order={1}>
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
        </Panel>
      )}
      <TitledPanel title="Edit annotations">
        <SpanAnnotationsEditor
          projectId={data.project.id}
          spanNodeId={data.id}
        />
      </TitledPanel>
    </PanelGroup>
  );
}

const TitledPanel = forwardRef<
  ImperativePanelHandle | null,
  PropsWithChildren<{ title: React.ReactNode }>
>(({ children, title }, ref) => {
  const panelRef = useRef<ImperativePanelHandle | null>(null);
  useImperativeHandle<
    ImperativePanelHandle | null,
    ImperativePanelHandle | null
  >(ref, () => panelRef.current);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <PanelResizeHandle
        css={css`
          padding-top: var(--ac-global-dimension-size-50);
          &:not([data-resize-handle-state="drag"]) + [data-panel] {
            transition: flex 0.2s ease-in-out;
          }
          &:focus,
          &:focus-visible,
          &:active {
            outline: 1px solid var(--ac-global-border-color-default);
          }
        `}
        onClick={() => {
          const panel = panelRef.current;
          if (panel?.getSize() === 0) {
            panel?.expand();
          } else {
            panel?.collapse();
          }
        }}
      >
        <Flex
          alignItems="center"
          css={css`
            font-weight: var(--px-font-weight-heavy);
            font-size: var(--ac-global-font-size-s);
          `}
        >
          <Icon
            data-collapsed={collapsed}
            svg={<Icons.ChevronDown />}
            css={css`
              font-size: var(--ac-global-font-size-xl);
              transition: transform 0.2s ease-in-out;
              &[data-collapsed="true"] {
                transform: rotate(270deg);
              }
            `}
          />
          {title}
        </Flex>
      </PanelResizeHandle>
      <Panel
        order={2}
        ref={panelRef}
        collapsible
        onCollapse={() => setCollapsed(true)}
        onExpand={() => setCollapsed(false)}
      >
        {children}
      </Panel>
    </>
  );
});

TitledPanel.displayName = "TitledPanel";
