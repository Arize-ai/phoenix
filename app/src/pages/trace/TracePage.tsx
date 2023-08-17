import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useNavigate, useParams } from "react-router";
import { useSearchParams } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import {
  Dialog,
  DialogContainer,
  TabPane,
  Tabs,
  View,
} from "@arizeai/components";

import { resizeHandleCSS } from "@phoenix/components/resize";
import { TraceTree } from "@phoenix/components/trace/TraceTree";

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
        spans(traceIds: [$traceId], sort: { col: startTime, dir: asc }) {
          edges {
            span: node {
              context {
                spanId
              }
              name
              spanKind
              startTime
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
  const urlSelectedSpanId = searchParams.get("selectedSpanId");
  const selectedSpanId = urlSelectedSpanId ?? spansList[0].context.spanId;
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
                  <TraceTree
                    spans={spansList}
                    selectedSpanId={selectedSpanId}
                    onSpanClick={(spanId) => {
                      setSearchParams(
                        {
                          selectedSpanId: spanId,
                        },
                        { replace: true }
                      );
                    }}
                  />
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
                  <View margin="size-100" borderRadius="medium">
                    <CodeMirror
                      value={JSON.stringify(
                        JSON.parse(selectedSpan?.attributes ?? "{}"),
                        null,
                        2
                      )}
                      theme="dark"
                      lang="json"
                    />
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
