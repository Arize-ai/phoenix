import React, { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useNavigate, useParams } from "react-router";
import { useSearchParams } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import {
  Card,
  Counter,
  Dialog,
  DialogContainer,
  Flex,
  Icon,
  Icons,
  List,
  ListItem,
  TabPane,
  Tabs,
  Text,
  View,
} from "@arizeai/components";

import { resizeHandleCSS } from "@phoenix/components/resize";
import { TraceTree } from "@phoenix/components/trace/TraceTree";

import {
  MimeType,
  TracePageQuery,
  TracePageQuery$data,
} from "./__generated__/TracePageQuery.graphql";

type Span = TracePageQuery$data["spans"]["edges"][number]["span"];

const spanHasException = (span: Span) => {
  return span.events.some((event) => event.name === "exception");
};

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
              statusCode
              startTime
              parentId
              latencyMs
              input {
                value
                mimeType
              }
              output {
                value
                mimeType
              }
              attributes
              events {
                name
                message
                timestamp
              }
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
              {selectedSpan ? (
                <SelectedSpanDetails selectedSpan={selectedSpan} />
              ) : null}
            </Panel>
          </PanelGroup>
        </main>
      </Dialog>
    </DialogContainer>
  );
}

function SelectedSpanDetails({ selectedSpan }: { selectedSpan: Span }) {
  const hasExceptions = useMemo<boolean>(() => {
    return spanHasException(selectedSpan);
  }, [selectedSpan]);
  return (
    <Tabs>
      <TabPane name={"Info"} title="Info">
        <SpanInfo span={selectedSpan} />
      </TabPane>
      <TabPane name={"Attributes"} title="Attributes">
        <View margin="size-100" borderRadius="medium">
          <CodeMirror
            value={JSON.stringify(
              JSON.parse(selectedSpan.attributes ?? "{}"),
              null,
              2
            )}
            theme="dark"
            lang="json"
          />
        </View>
      </TabPane>
      <TabPane
        name={"Events"}
        title="Events"
        extra={
          <Counter variant={hasExceptions ? "danger" : "default"}>
            {selectedSpan.events.length}
          </Counter>
        }
      >
        <View margin="size-100" borderRadius="medium">
          <SpanEventsList events={selectedSpan.events} />
        </View>
      </TabPane>
    </Tabs>
  );
}

function SpanInfo({ span }: { span: Span }) {
  const { input, output } = span;
  return (
    <View padding="size-100">
      <Flex direction="column">
        {input && input.value != null ? (
          <CodeBlock title="Input" {...input} />
        ) : null}
        {output && output.value != null ? (
          <CodeBlock title="Output" {...output} />
        ) : null}
      </Flex>
    </View>
  );
}

function CodeBlock({
  title,
  value,
}: {
  title: string;
  value: string;
  mimeType: MimeType;
}) {
  return (
    <Card
      collapsible
      variant="compact"
      title={title}
      bodyStyle={{ padding: 0 }}
    >
      <CodeMirror value={value} theme="dark" lang="json" />
    </Card>
  );
}

function SpanEventsList({ events }: { events: Span["events"] }) {
  return (
    <List>
      {events.map((event, idx) => {
        const isException = event.name === "exception";

        return (
          <ListItem key={idx}>
            <Flex direction="row" alignItems="center" gap="size-100">
              <View>
                <div
                  data-event-type={isException ? "exception" : "info"}
                  css={(theme) => css`
                    &[data-event-type="exception"] {
                      --px-event-icon-color: ${theme.colors.statusDanger};
                    }
                    &[data-event-type="info"] {
                      --px-event-icon-color: ${theme.colors.statusInfo};
                    }
                    .ac-icon-wrap {
                      color: var(--px-event-icon-color);
                    }
                  `}
                >
                  <Icon
                    svg={
                      isException ? (
                        <Icons.AlertTriangleOutline />
                      ) : (
                        <Icons.InfoOutline />
                      )
                    }
                  />
                </div>
              </View>
              <Flex direction="column" gap="size-25" flex="1 1 auto">
                <Text weight="heavy">{event.name}</Text>
                <Text color="white70">{event.message}</Text>
              </Flex>
              <View>
                <Text color="white70">
                  {new Date(event.timestamp).toLocaleString()}
                </Text>
              </View>
            </Flex>
          </ListItem>
        );
      })}
    </List>
  );
}
