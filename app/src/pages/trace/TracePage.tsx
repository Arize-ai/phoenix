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
  Card,
  CardProps,
  Counter,
  Dialog,
  DialogContainer,
  EmptyGraphic,
  Flex,
  Heading,
  Icon,
  Icons,
  Label,
  List,
  ListItem,
  TabbedCard,
  TabPane,
  Tabs,
  Text,
  View,
  ViewStyleProps,
} from "@arizeai/components";

import { resizeHandleCSS } from "@phoenix/components/resize";
import { SpanItem } from "@phoenix/components/trace/SpanItem";
import { TraceTree } from "@phoenix/components/trace/TraceTree";
import {
  DOCUMENT_CONTENT,
  DOCUMENT_ID,
  DOCUMENT_SCORE,
  EMBEDDING_TEXT,
  EmbeddingAttributePostfixes,
  LLMAttributePostfixes,
  MESSAGE_CONTENT,
  MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON,
  MESSAGE_FUNCTION_CALL_NAME,
  MESSAGE_NAME,
  MESSAGE_ROLE,
  RetrievalAttributePostfixes,
  SemanticAttributePrefixes,
  ToolAttributePostfixes,
} from "@phoenix/openInference/tracing/semanticConventions";
import {
  AttributeDocument,
  AttributeEmbedding,
  AttributeMessage,
} from "@phoenix/openInference/tracing/types";
import { assertUnreachable, isStringArray } from "@phoenix/typeUtils";
import { numberFormatter } from "@phoenix/utils/numberFormatUtils";

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
 * Card props to apply across all cards
 */
const defaultCardProps: Partial<CardProps> = {
  backgroundColor: "light",
  borderColor: "light",
  bodyStyle: {
    padding: 0,
  },
  variant: "compact",
  collapsible: true,
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
              tokenCountTotal
              tokenCountPrompt
              tokenCountCompletion
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
            flex: 1 1 auto;
            overflow: hidden;
          `}
        >
          <PanelGroup direction="horizontal" autoSaveId="trace-panel-group">
            <Panel defaultSize={30} minSize={10} maxSize={40}>
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
      data-testid="scrolling-tabs-wrapper"
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
    <Flex direction="column">
      <View
        paddingTop="size-75"
        paddingBottom="size-75"
        paddingStart="size-150"
        paddingEnd="size-200"
      >
        <SpanItem {...selectedSpan} />
      </View>
      <Tabs>
        <TabPane name={"Info"}>
          <SpanInfo span={selectedSpan} />
        </TabPane>
        <TabPane name={"Attributes"} title="Attributes">
          <View padding="size-200">
            <Card title="All Attributes" {...defaultCardProps}>
              <CodeBlock value={selectedSpan.attributes} mimeType="json" />
            </Card>
          </View>
        </TabPane>
        <TabPane
          name={"Events"}
          extra={
            <Counter variant={hasExceptions ? "danger" : "default"}>
              {selectedSpan.events.length}
            </Counter>
          }
        >
          <SpanEventsList events={selectedSpan.events} />
        </TabPane>
      </Tabs>
    </Flex>
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
    case "retriever": {
      content = (
        <RetrieverSpanInfo span={span} spanAttributes={attributesObject} />
      );
      break;
    }
    case "embedding": {
      content = (
        <EmbeddingSpanInfo span={span} spanAttributes={attributesObject} />
      );
      break;
    }
    case "tool": {
      content = <ToolSpanInfo span={span} spanAttributes={attributesObject} />;
      break;
    }
    default:
      content = <SpanIO span={span} />;
  }
  return <View padding="size-200">{content}</View>;
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

  const prompts = useMemo<string[]>(() => {
    if (llmAttributes == null) {
      return [];
    }
    const maybePrompts = llmAttributes[LLMAttributePostfixes.prompts];
    if (!isStringArray(maybePrompts)) {
      return [];
    }
    return maybePrompts;
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
  const hasPrompts = prompts.length > 0;
  const hasInvocationParams =
    Object.keys(JSON.parse(invocation_parameters_str)).length > 0;
  return (
    <Flex direction="column" gap="size-200">
      <TabbedCard {...defaultCardProps}>
        <Tabs>
          {hasInput ? (
            <TabPane name="Input" hidden={!hasInput}>
              <CodeBlock {...input} />
            </TabPane>
          ) : null}
          <TabPane name="Messages" hidden={!hasMessages}>
            <LLMMessagesList messages={messages} />
          </TabPane>
          <TabPane name="Prompts" hidden={!hasPrompts}>
            <LLMPromptsList prompts={prompts} />
          </TabPane>
          <TabPane name="Invocation Params" hidden={!hasInvocationParams}>
            <CodeBlock
              {...{
                mimeType: "json",
                value: invocation_parameters_str,
              }}
            />
          </TabPane>
        </Tabs>
      </TabbedCard>
      {output && output.value != null ? (
        <Card title="Output" {...defaultCardProps}>
          <CodeBlock {...output} />
        </Card>
      ) : null}
    </Flex>
  );
}

function RetrieverSpanInfo(props: {
  span: Span;
  spanAttributes: AttributeObject;
}) {
  const { spanAttributes, span } = props;
  const { input } = span;
  const retrieverAttributes = useMemo<AttributeObject | null>(() => {
    const retrieverAttrs = spanAttributes[SemanticAttributePrefixes.retrieval];
    if (typeof retrieverAttrs === "object") {
      return retrieverAttrs as AttributeObject;
    }
    return null;
  }, [spanAttributes]);
  const documents = useMemo<AttributeDocument[]>(() => {
    if (retrieverAttributes == null) {
      return [];
    }
    return (retrieverAttributes[RetrievalAttributePostfixes.documents] ||
      []) as AttributeDocument[];
  }, [retrieverAttributes]);

  const hasInput = input != null && input.value != null;
  const hasDocuments = documents.length > 0;
  return (
    <Flex direction="column" gap="size-200">
      <Card title="Input" {...defaultCardProps}>
        {hasInput ? <CodeBlock {...input} /> : null}
      </Card>
      {hasDocuments ? (
        <Card title="Documents" {...defaultCardProps}>
          {
            <ul
              css={css`
                padding: var(--ac-global-dimension-static-size-200);
                display: flex;
                flex-direction: column;
                gap: var(--ac-global-dimension-static-size-200);
              `}
            >
              {documents.map((document, idx) => {
                return (
                  <li key={idx}>
                    <DocumentItem document={document} />
                  </li>
                );
              })}
            </ul>
          }
        </Card>
      ) : null}
    </Flex>
  );
}

function EmbeddingSpanInfo(props: {
  span: Span;
  spanAttributes: AttributeObject;
}) {
  const { spanAttributes } = props;
  const embeddingAttributes = useMemo<AttributeObject | null>(() => {
    const embeddingAttrs = spanAttributes[SemanticAttributePrefixes.embedding];
    if (typeof embeddingAttrs === "object") {
      return embeddingAttrs as AttributeObject;
    }
    return null;
  }, [spanAttributes]);
  const embeddings = useMemo<AttributeEmbedding[]>(() => {
    if (embeddingAttributes == null) {
      return [];
    }
    return (embeddingAttributes[EmbeddingAttributePostfixes.embeddings] ||
      []) as AttributeDocument[];
  }, [embeddingAttributes]);

  const hasEmbeddings = embeddings.length > 0;
  const modelName =
    embeddingAttributes?.[EmbeddingAttributePostfixes.model_name];
  return (
    <Flex direction="column" gap="size-200">
      {hasEmbeddings ? (
        <Card
          title={
            "Embeddings" +
            (typeof modelName === "string" ? `: ${modelName}` : "")
          }
          {...defaultCardProps}
        >
          {
            <ul
              css={css`
                padding: var(--ac-global-dimension-static-size-200);
                display: flex;
                flex-direction: column;
                gap: var(--ac-global-dimension-static-size-200);
              `}
            >
              {embeddings.map((embedding, idx) => {
                return (
                  <li key={idx}>
                    <View
                      padding="size-200"
                      backgroundColor="indigo-100"
                      borderColor="indigo-700"
                      borderWidth="thin"
                      borderRadius="medium"
                    >
                      <Text color="white70" fontStyle="italic">
                        embedded text
                      </Text>
                      <pre
                        css={css`
                          margin: var(--ac-global-dimension-static-size-100) 0;
                        `}
                      >
                        {embedding[EMBEDDING_TEXT]}
                      </pre>
                    </View>
                  </li>
                );
              })}
            </ul>
          }
        </Card>
      ) : null}
    </Flex>
  );
}

function ToolSpanInfo(props: { span: Span; spanAttributes: AttributeObject }) {
  const { spanAttributes } = props;
  const toolAttributes = useMemo<AttributeObject>(() => {
    const toolAttrs = spanAttributes[SemanticAttributePrefixes.tool];
    if (typeof toolAttrs === "object") {
      return toolAttrs as AttributeObject;
    }
    return {};
  }, [spanAttributes]);

  const hasToolAttributes = Object.keys(toolAttributes).length > 0;
  if (!hasToolAttributes) {
    return null;
  }
  const toolName = toolAttributes[ToolAttributePostfixes.name];
  const toolDescription = toolAttributes[ToolAttributePostfixes.description];
  const toolParameters = toolAttributes[ToolAttributePostfixes.parameters];
  return (
    <Flex direction="column" gap="size-200">
      <Card
        title={"Tool" + (typeof toolName === "string" ? `: ${toolName}` : "")}
        {...defaultCardProps}
      >
        <Flex direction="column">
          {toolDescription != null ? (
            <View
              paddingStart="size-200"
              paddingEnd="size-200"
              paddingTop="size-100"
              paddingBottom="size-100"
              borderBottomColor="dark"
              borderBottomWidth="thin"
              backgroundColor="light"
            >
              <Flex direction="column" alignItems="start" gap="size-50">
                <Text color="white70" fontStyle="italic">
                  Description
                </Text>
                <Text>{toolDescription as string}</Text>
              </Flex>
            </View>
          ) : null}
          {toolParameters != null ? (
            <View
              paddingStart="size-200"
              paddingEnd="size-200"
              paddingTop="size-100"
              paddingBottom="size-100"
              borderBottomColor="dark"
              borderBottomWidth="thin"
            >
              <Flex direction="column" alignItems="start" width="100%">
                <Text color="white70" fontStyle="italic">
                  Parameters
                </Text>
                <CodeBlock
                  value={JSON.stringify(toolParameters) as string}
                  mimeType="json"
                />
              </Flex>
            </View>
          ) : null}
        </Flex>
      </Card>
    </Flex>
  );
}

function DocumentItem({ document }: { document: AttributeDocument }) {
  return (
    <View
      borderRadius="medium"
      backgroundColor="blue-100"
      borderColor="blue-700"
      borderWidth="thin"
    >
      <Flex direction="column">
        <View
          width="100%"
          borderBottomWidth="thin"
          borderBottomColor="blue-700"
        >
          <Flex
            direction="row"
            justifyContent="space-between"
            margin="size-200"
            alignItems="center"
          >
            <Flex direction="row" gap="size-50" alignItems="center">
              <Icon svg={<Icons.FileOutline />} />
              <Heading level={4}>document {document[DOCUMENT_ID]}</Heading>
            </Flex>
            {typeof document[DOCUMENT_SCORE] === "number" && (
              <Label color="blue">{`score ${numberFormatter(
                document[DOCUMENT_SCORE]
              )}`}</Label>
            )}
          </Flex>
        </View>
        <pre
          css={css`
            padding: var(--ac-global-dimension-static-size-200);
            white-space: normal;
            margin: 0;
          `}
        >
          {document[DOCUMENT_CONTENT]}
        </pre>
      </Flex>
    </View>
  );
}

function LLMMessage({ message }: { message: AttributeMessage }) {
  const messageContent = message[MESSAGE_CONTENT];
  const hasFunctionCall =
    message[MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON] &&
    message[MESSAGE_FUNCTION_CALL_NAME];
  const role = message[MESSAGE_ROLE];
  const messageStyles = useMemo<ViewStyleProps>(() => {
    if (role === "user") {
      return {
        backgroundColor: "gray-600",
        borderColor: "gray-100",
      };
    } else if (role === "assistant") {
      return {
        backgroundColor: "blue-100",
        borderColor: "blue-700",
      };
    } else if (role === "system") {
      return {
        backgroundColor: "yellow-100",
        borderColor: "yellow-700",
      };
    } else if (role === "function") {
      return {
        backgroundColor: "purple-100",
        borderColor: "purple-700",
      };
    }
    return {
      backgroundColor: "gray-600",
      borderColor: "gray-400",
    };
  }, [role]);

  return (
    <View
      padding="size-200"
      margin="size-200"
      borderWidth="thin"
      borderRadius="medium"
      {...messageStyles}
    >
      <Flex direction="column" alignItems="start">
        <Text color="white70" fontStyle="italic">
          {role}
          {message[MESSAGE_NAME] ? `: ${message[MESSAGE_NAME]}` : ""}
        </Text>
        {messageContent ? (
          <pre
            css={css`
              text-wrap: wrap;
              margin: var(--ac-global-dimension-static-size-100) 0;
            `}
          >
            {message[MESSAGE_CONTENT]}
          </pre>
        ) : null}
        {hasFunctionCall ? (
          <pre
            css={css`
              text-wrap: wrap;
              margin: var(--ac-global-dimension-static-size-100) 0;
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
  );
}
function LLMMessagesList({ messages }: { messages: AttributeMessage[] }) {
  return (
    <ul>
      {messages.map((message, idx) => {
        return (
          <li key={idx}>
            <LLMMessage message={message} />
          </li>
        );
      })}
    </ul>
  );
}

function LLMPromptsList({ prompts }: { prompts: string[] }) {
  return (
    <ul
      data-testid="llm-prompts-list"
      css={css`
        padding: var(--ac-global-dimension-size-200);
        display: flex;
        flex-direction: column;
        gap: var(--ac-global-dimension-size-100);
      `}
    >
      {prompts.map((prompt, idx) => {
        return (
          <li key={idx}>
            <View
              backgroundColor="gray-600"
              borderColor="gray-400"
              borderWidth="thin"
              borderRadius="medium"
              padding="size-100"
            >
              <pre
                css={css`
                  text-wrap: wrap;
                  margin: 0;
                `}
              >
                {prompt}
              </pre>
            </View>
          </li>
        );
      })}
    </ul>
  );
}

function SpanIO({ span }: { span: Span }) {
  const { input, output } = span;
  const isEmpty = input == null && output == null;
  return (
    <Flex direction="column" gap="size-200">
      {input && input.value != null ? (
        <Card title="Input" {...defaultCardProps}>
          <CodeBlock {...input} />
        </Card>
      ) : null}
      {output && output.value != null ? (
        <Card title="Output" {...defaultCardProps}>
          <CodeBlock {...output} />
        </Card>
      ) : null}
      {isEmpty ? <EmptyIndicator text="No input or output" /> : null}
    </Flex>
  );
}

const codeMirrorCSS = css`
  .cm-content {
    padding: var(--ac-global-dimension-static-size-200) 0;
  }
  .cm-editor,
  .cm-gutters {
    background-color: transparent;
  }
`;
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
          css={codeMirrorCSS}
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
          css={codeMirrorCSS}
        />
      );
      break;
    default:
      assertUnreachable(mimeType);
  }

  return content;
}

function EmptyIndicator({ text }: { text: string }) {
  return (
    <Flex
      direction="column"
      alignItems="center"
      flex="1 1 auto"
      height="size-2400"
      justifyContent="center"
      gap="size-100"
    >
      <EmptyGraphic graphicKey="documents" />
      <Text>{text}</Text>
    </Flex>
  );
}
function SpanEventsList({ events }: { events: Span["events"] }) {
  if (events.length === 0) {
    return <EmptyIndicator text="No events" />;
  }
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
