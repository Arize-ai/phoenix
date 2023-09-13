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
  MESSAGE_CONTENT,
  MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON,
  MESSAGE_FUNCTION_CALL_NAME,
  MESSAGE_NAME,
  MESSAGE_ROLE,
  SemanticAttributePrefixes,
} from "@phoenix/openInference/tracing/semanticConventions";
import { AttributeMessage } from "@phoenix/openInference/tracing/types";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  MimeType,
  TracePageQuery,
  TracePageQuery$data,
} from "./__generated__/TracePageQuery.graphql";

type Span = TracePageQuery$data["spans"]["edges"][number]["span"];
/**
 * A span attribute object that is a map of string to an unknown value
 */
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
      <Dialog size="XL" title="Trace Details">
        <main
          css={css`
            height: 100%;
          `}
        >
          <PanelGroup direction="horizontal" autoSaveId="trace-panel-group">
            <Panel defaultSize={30} minSize={10} maxSize={40}>
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
function BlockView({ children, title }: PropsWithChildren<{ title?: string }>) {
  return (
    <View borderColor="dark" borderRadius="medium" borderWidth="thin">
      {title ? (
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
      ) : null}
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

  const messages = useMemo<AttributeMessage[]>(() => {
    if (llmAttributes == null) {
      return [];
    }
    return (llmAttributes[LLMAttributePostfixes.messages] ||
      []) as AttributeMessage[];
  }, [llmAttributes]);

  const invocation_parameters_str = useMemo<string>(() => {
    if (llmAttributes == null) {
      return "{}";
    }
    return (llmAttributes[LLMAttributePostfixes.invocation_parameters] ||
      "{}") as string;
  }, [llmAttributes]);

  const hasInput = input != null && input.value != null;
  const hasMessages = messages.length > 0;
  const hasInvocationParams =
    Object.keys(JSON.parse(invocation_parameters_str)).length > 0;
  return (
    <Flex direction="column" gap="size-200">
      <BlockView>
        <Tabs>
          {hasInput ? (
            <TabPane name="Input" title="Input" hidden={!hasInput}>
              <CodeBlock {...input} />
            </TabPane>
          ) : null}
          <TabPane name="Messages" title="Messages" hidden={!hasMessages}>
            <LLMMessagesList messages={messages} />
          </TabPane>
          <TabPane
            name="Invocation Params"
            title="Invocation Params"
            hidden={!hasInvocationParams}
          >
            <CodeBlock
              {...{
                mimeType: "json",
                value: invocation_parameters_str,
              }}
            />
          </TabPane>
        </Tabs>
      </BlockView>
      {output && output.value != null ? (
        <BlockView title="Output">
          <CodeBlock {...output} />
        </BlockView>
      ) : null}
    </Flex>
  );
}

function LLMMessagesList({ messages }: { messages: AttributeMessage[] }) {
  return (
    <ul>
      {messages.map((message, idx) => {
        const messageContent = message[MESSAGE_CONTENT];
        const hasFunctionCall =
          message[MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON] &&
          message[MESSAGE_FUNCTION_CALL_NAME];
        return (
          <li key={idx}>
            <View
              margin="size-100"
              padding="size-100"
              backgroundColor="light"
              borderRadius="medium"
            >
              <Flex direction="column" alignItems="start" gap="size-100">
                <Text color="white70" fontStyle="italic">
                  {message[MESSAGE_ROLE]}
                  {message[MESSAGE_NAME] ? `: ${message[MESSAGE_NAME]}` : ""}
                </Text>
                {messageContent ? (
                  <pre
                    css={css`
                      text-wrap: wrap;
                      margin: 0;
                    `}
                  >
                    {message[MESSAGE_CONTENT]}
                  </pre>
                ) : null}
                {hasFunctionCall ? (
                  <pre
                    css={css`
                      text-wrap: wrap;
                      margin: 0;
                    `}
                  >
                    {message[MESSAGE_FUNCTION_CALL_NAME] as string}(
                    {JSON.stringify(
                      JSON.parse(
                        message[MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON] as string
                      ),
                      null,
                      2
                    )}
                    )
                  </pre>
                ) : null}
              </Flex>
            </View>
          </li>
        );
      })}
    </ul>
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
