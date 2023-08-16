import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useNavigate, useParams } from "react-router";
import { useSearchParams } from "react-router-dom";
import { css } from "@emotion/react";

import {
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
  const [searchParams, setSearchParams] = useSearchParams();
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
              attributes
            }
          }
        }
      }
    `,
    { traceId: traceId as string }
  );
  const spansList = data.spans.edges.map((edge) => edge.span);
  const selectedSpanId =
    searchParams.get("selectedSpanId") ?? spansList[0].context.spanId;
  const selectedSpan = spansList.find(
    (span) => span.context.spanId === selectedSpanId
  );
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
                        <button
                          className="button--reset"
                          onClick={() => {
                            setSearchParams({
                              selectedSpanId: span.context.spanId,
                            });
                          }}
                        >
                          <View
                            borderRadius="medium"
                            backgroundColor="light"
                            padding="size-100"
                            borderWidth="thin"
                            borderColor={
                              selectedSpanId === span.context.spanId
                                ? "light"
                                : "default"
                            }
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
            <Panel>
              {/* @ts-expect-error for now just using tab as a title */}
              <Tabs>
                <TabPane name={"Attributes"} title="Attributes">
                  <View
                    margin="size-100"
                    backgroundColor="light"
                    borderRadius="medium"
                  >
                    <pre>
                      {JSON.stringify(
                        JSON.parse(selectedSpan?.attributes || "{}"),
                        null,
                        2
                      )}
                    </pre>
                  </View>
                </TabPane>
              </Tabs>
            </Panel>
          </PanelGroup>
        </main>
      </Dialog>
    </DialogContainer>
  );
}
