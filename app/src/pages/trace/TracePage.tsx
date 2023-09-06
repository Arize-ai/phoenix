import React, { PropsWithChildren, ReactNode, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useNavigate, useParams } from "react-router";
import { useSearchParams } from "react-router-dom";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import {
  Counter,
  Dialog,
  DialogContainer,
  Flex,
  Heading,
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
import { SpanItem } from "@phoenix/components/trace/SpanItem";
import { TraceTree } from "@phoenix/components/trace/TraceTree";
import {
  LLMAttributePostfixes,
  SemanticAttributePrefixes,
} from "@phoenix/open_inference/tracing/semantic_conventions";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  MimeType,
  TracePageQuery,
  TracePageQuery$data,
} from "./__generated__/TracePageQuery.graphql";

type Span = TracePageQuery$data["spans"]["edges"][number]["span"];
type AttributeObject = Record<string, unknown>;

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
          <PanelGroup direction="vertical" autoSaveId="trace-panel-group">
            <Panel defaultSize={40}>
              <ScrollingTabsWrapper>
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
              </ScrollingTabsWrapper>
            </Panel>
            <PanelResizeHandle css={resizeHandleCSS} />
            <Panel>
              <ScrollingTabsWrapper>
                {selectedSpan ? (
                  <SelectedSpanDetails selectedSpan={selectedSpan} />
                ) : null}
              </ScrollingTabsWrapper>
            </Panel>
          </PanelGroup>
        </main>
      </Dialog>
    </DialogContainer>
  );
}

function ScrollingTabsWrapper({ children }: PropsWithChildren) {
  return (
    <div
      css={css`
        height: 100%;
        .ac-tabs {
          height: 100%;
          .ac-tabs__pane-container {
            height: 100%;
            overflow-y: auto;
          }
        }
      `}
    >
      {children}
    </div>
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
        <View padding="size-200">
          <BlockView title="All Attributes">
            <CodeBlock value={selectedSpan.attributes} mimeType="json" />
          </BlockView>
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

/**
 * A simple container to show a block of text or code
 */
function BlockView({ children, title }: PropsWithChildren<{ title: string }>) {
  return (
    <View borderColor="dark" borderRadius="medium" borderWidth="thin">
      <View
        paddingStart="size-150"
        paddingEnd="size-150"
        paddingTop="size-50"
        paddingBottom="size-50"
        borderBottomColor="dark"
        borderBottomWidth="thin"
      >
        <Heading level={4}>{title}</Heading>
      </View>
      {children}
    </View>
  );
}

function SpanInfo({ span }: { span: Span }) {
  const { spanKind, attributes } = span;

  // Parse the attributes once
  const attributesObject = useMemo<{ [key: string]: unknown }>(() => {
    return JSON.parse(attributes);
  }, [attributes]);

  let content: ReactNode;
  switch (spanKind) {
    case "llm": {
      content = <LLMSpanInfo span={span} spanAttributes={attributesObject} />;
      break;
    }
    default:
      content = <SpanIO span={span} />;
  }
  return (
    <Flex direction="column">
      <View
        paddingTop="size-50"
        paddingBottom="size-50"
        paddingStart="size-250"
        paddingEnd="size-250"
        borderBottomColor="dark"
        borderBottomWidth="thin"
        backgroundColor="dark"
      >
        <SpanItem {...span} />
      </View>
      <View padding="size-200">{content}</View>
    </Flex>
  );
}

function LLMSpanInfo(props: { span: Span; spanAttributes: AttributeObject }) {
  const { spanAttributes, span } = props;
  const { input, output } = span;
  const llmAttributes = useMemo<AttributeObject | null>(() => {
    const llmAttrs = spanAttributes[SemanticAttributePrefixes.llm];
    if (typeof llmAttrs === "object") {
      return llmAttrs as AttributeObject;
    }
    return null;
  }, [spanAttributes]);

  const messages = useMemo(() => {
    if (llmAttributes == null) {
      return null;
    }
    return llmAttributes[LLMAttributePostfixes.messages] as string;
  }, [llmAttributes]);

  const invocation_parameters = useMemo(() => {
    if (llmAttributes == null) {
      return null;
    }
    return llmAttributes[LLMAttributePostfixes.invocation_parameters];
  }, [llmAttributes]);

  return (
    <Flex direction="column" gap="size-200">
      {invocation_parameters ? (
        <BlockView title="Invocation Parameters">
          <CodeBlock
            value={JSON.stringify(
              JSON.parse(invocation_parameters as string),
              null,
              2
            )}
            mimeType="json"
          />
        </BlockView>
      ) : null}
      {messages != null ? (
        <BlockView title="Messages">
          <CodeBlock
            {...{ mimeType: "json", value: JSON.stringify(messages) }}
          />
        </BlockView>
      ) : null}
      {input && input?.value != null ? (
        <BlockView title="Input">
          <CodeBlock {...input} />
        </BlockView>
      ) : null}
      {output && output.value != null ? (
        <BlockView title="Output">
          <CodeBlock {...output} />
        </BlockView>
      ) : null}
    </Flex>
  );
}

function SpanIO({ span }: { span: Span }) {
  const { input, output } = span;
  return (
    <Flex direction="column" gap="size-200">
      {input && input.value != null ? (
        <BlockView title="Input">
          <CodeBlock {...input} />
        </BlockView>
      ) : null}
      {output && output.value != null ? (
        <BlockView title="Output">
          <CodeBlock {...output} />
        </BlockView>
      ) : null}
    </Flex>
  );
}

function CodeBlock({ value, mimeType }: { value: string; mimeType: MimeType }) {
  let content;
  switch (mimeType) {
    case "json":
      content = (
        <CodeMirror
          value={JSON.stringify(JSON.parse(value), null, 2)}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            bracketMatching: true,
            syntaxHighlighting: true,
            highlightActiveLine: false,
          }}
          extensions={[json(), EditorView.lineWrapping]}
          editable={false}
          theme={nord}
        />
      );
      break;
    case "text":
      content = (
        <CodeMirror
          value={value}
          theme={nord}
          editable={false}
          basicSetup={{
            lineNumbers: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            syntaxHighlighting: true,
          }}
          extensions={[EditorView.lineWrapping]}
        />
      );
      break;
    default:
      assertUnreachable(mimeType);
  }

  return content;
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
