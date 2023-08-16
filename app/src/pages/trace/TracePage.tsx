import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useNavigate, useParams } from "react-router";
import { css } from "@emotion/react";

import {
  ActionButton,
  Dialog,
  DialogContainer,
  TabPane,
  Tabs,
  View,
} from "@arizeai/components";

import { resizeHandleCSS } from "@phoenix/components/resize";
import { SpanItem } from "@phoenix/components/trace/SpanItem";

import { TracePageQuery } from "./__generated__/TracePageQuery.graphql";

/**
 * A page that shows the details of a trace (e.g. a collection of spans)
 */
export function TracePage() {
  const { traceId } = useParams();
  const navigate = useNavigate();

  const data = useLazyLoadQuery<TracePageQuery>(
    graphql`
      query TracePageQuery($traceId: ID!) {
        spans(traceIds: [$traceId], sort: { col: startTime, dir: desc }) {
          edges {
            span: node {
              context {
                spanId
              }
              name
              spanKind
              parentId
              latencyMs
            }
          }
        }
      }
    `,
    { traceId: traceId as string }
  );
  const spansList = data.spans.edges.map((edge) => edge.span);
  return (
    <DialogContainer
      type="slideOver"
      isDismissable
      onDismiss={() => navigate(-1)}
    >
      <Dialog size="L" title="Trace Details">
        <main
          css={css`
            height: 100%;
          `}
        >
          <PanelGroup direction="vertical">
            <Panel defaultSize={40}>
              <Tabs>
                <TabPane name="Tree" title="Tree">
                  <ul
                    css={(theme) => css`
                      margin: ${theme.spacing.margin16}px;
                      display: flex;
                      flex-direction: column;
                      gap: ${theme.spacing.padding8}px;
                    `}
                  >
                    {spansList.map((span) => (
                      <li
                        key={span.context.spanId}
                        css={css`
                          display: flex;
                          width: 100%;
                          button {
                            flex: 1 1 auto;
                          }
                        `}
                      >
                        <button className="button--reset">
                          <View
                            borderRadius="medium"
                            backgroundColor="light"
                            padding="size-100"
                          >
                            <SpanItem {...span} />
                          </View>
                        </button>
                      </li>
                    ))}
                  </ul>
                </TabPane>
                <TabPane name="Flame Graph" hidden>
                  Flame Graph
                </TabPane>
              </Tabs>
            </Panel>
            <PanelResizeHandle css={resizeHandleCSS} />
            <Panel></Panel>
          </PanelGroup>
        </main>
      </Dialog>
    </DialogContainer>
  );
}
