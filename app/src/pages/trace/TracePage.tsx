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
  Content,
  ContextualHelp,
  Counter,
  Dialog,
  DialogContainer,
  EmptyGraphic,
  Flex,
  Heading,
  Icon,
  Icons,
  Label,
  LabelProps,
  List,
  ListItem,
  TabbedCard,
  TabPane,
  Tabs,
  Text,
  View,
  ViewProps,
  ViewStyleProps,
} from "@arizeai/components";

import { ExternalLink } from "@phoenix/components";
import { resizeHandleCSS } from "@phoenix/components/resize";
import { SpanItem } from "@phoenix/components/trace/SpanItem";
import { SpanKindIcon } from "@phoenix/components/trace/SpanKindIcon";
import { TraceTree } from "@phoenix/components/trace/TraceTree";
import { useTheme } from "@phoenix/contexts";
import {
  DOCUMENT_CONTENT,
  DOCUMENT_ID,
  DOCUMENT_METADATA,
  DOCUMENT_SCORE,
  EMBEDDING_TEXT,
  EmbeddingAttributePostfixes,
  LLMAttributePostfixes,
  LLMPromptTemplateAttributePostfixes,
  MESSAGE_CONTENT,
  MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON,
  MESSAGE_FUNCTION_CALL_NAME,
  MESSAGE_NAME,
  MESSAGE_ROLE,
  RerankerAttributePostfixes,
  RetrievalAttributePostfixes,
  SemanticAttributePrefixes,
  ToolAttributePostfixes,
} from "@phoenix/openInference/tracing/semanticConventions";
import {
  AttributeDocument,
  AttributeEmbedding,
  AttributeMessage,
  AttributePromptTemplate,
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

function isAttributeObject(value: unknown): value is AttributeObject {
  if (
    value != null &&
    typeof value === "object" &&
    !Object.keys(value).find((key) => typeof key != "string")
  ) {
    return true;
  }
  return false;
}

export function isAttributePromptTemplate(
  value: unknown
): value is AttributePromptTemplate {
  if (
    isAttributeObject(value) &&
    typeof value[LLMPromptTemplateAttributePostfixes.template] === "string" &&
    typeof value[LLMPromptTemplateAttributePostfixes.variables] === "object"
  ) {
    return true;
  }
  return false;
}

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
          overflow: hidden;
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

const attributesContextualHelp = (
  <Flex alignItems="center" justifyContent="center">
    <View marginStart="size-100">
      <ContextualHelp>
        <Heading weight="heavy" level={4}>
          Span Attributes
        </Heading>
        <Content>
          <Text>
            All attributes associated with the span. Attributes are key-value
            pairs that represent metadata associated with a span. For a detailed
            description of the attributes, consult the semantic conventions of
            the OpenInference tracing specification.
          </Text>
        </Content>
        <footer>
          <ExternalLink href="https://arize-ai.github.io/open-inference-spec/trace/spec/semantic_conventions.html">
            Semantic Conventions
          </ExternalLink>
        </footer>
      </ContextualHelp>
    </View>
  </Flex>
);

function SelectedSpanDetails({ selectedSpan }: { selectedSpan: Span }) {
  const hasExceptions = useMemo<boolean>(() => {
    return spanHasException(selectedSpan);
  }, [selectedSpan]);
  return (
    <Flex direction="column" flex="1 1 auto" height="100%">
      <View
        paddingTop="size-75"
        paddingBottom="size-75"
        paddingStart="size-150"
        paddingEnd="size-200"
        flex="none"
      >
        <SpanItem {...selectedSpan} />
      </View>
      <Tabs>
        <TabPane name={"Info"}>
          <SpanInfo span={selectedSpan} />
        </TabPane>
        <TabPane name={"Attributes"} title="Attributes">
          <View padding="size-200">
            <Card
              title="All Attributes"
              {...defaultCardProps}
              titleExtra={attributesContextualHelp}
            >
              <CodeBlock value={selectedSpan.attributes} mimeType="json" />
            </Card>
          </View>
        </TabPane>
        <TabPane
          name={"Events"}
          extra={
            <Counter variant={hasExceptions ? "danger" : "light"}>
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
    case "reranker": {
      content = (
        <RerankerSpanInfo span={span} spanAttributes={attributesObject} />
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

  const modelName = useMemo<string | null>(() => {
    if (llmAttributes == null) {
      return null;
    }
    const maybeModelName = llmAttributes[LLMAttributePostfixes.model_name];
    if (typeof maybeModelName === "string") {
      return maybeModelName;
    }
    return null;
  }, [llmAttributes]);

  const inputMessages = useMemo<AttributeMessage[]>(() => {
    if (llmAttributes == null) {
      return [];
    }
    return (llmAttributes[LLMAttributePostfixes.input_messages] ||
      []) as AttributeMessage[];
  }, [llmAttributes]);

  const outputMessages = useMemo<AttributeMessage[]>(() => {
    if (llmAttributes == null) {
      return [];
    }
    return (llmAttributes[LLMAttributePostfixes.output_messages] ||
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

  const promptTemplateObject = useMemo<AttributePromptTemplate | null>(() => {
    if (llmAttributes == null) {
      return null;
    }

    const maybePromptTemplate =
      llmAttributes[LLMAttributePostfixes.prompt_template];
    if (!isAttributePromptTemplate(maybePromptTemplate)) {
      return null;
    }
    return maybePromptTemplate;
  }, [llmAttributes]);

  const invocation_parameters_str = useMemo<string>(() => {
    if (llmAttributes == null) {
      return "{}";
    }
    return (llmAttributes[LLMAttributePostfixes.invocation_parameters] ||
      "{}") as string;
  }, [llmAttributes]);

  const modelNameTitleEl = useMemo<ReactNode>(() => {
    if (modelName == null) {
      return null;
    }
    return (
      <Flex direction="row" gap="size-100" alignItems="center">
        <SpanKindIcon spanKind="llm" />
        <Text textSize="large" weight="heavy">
          {modelName}
        </Text>
      </Flex>
    );
  }, [modelName]);
  const hasInput = input != null && input.value != null;
  const hasInputMessages = inputMessages.length > 0;
  const hasOutput = output != null && output.value != null;
  const hasOutputMessages = outputMessages.length > 0;
  const hasPrompts = prompts.length > 0;
  const hasInvocationParams =
    Object.keys(JSON.parse(invocation_parameters_str)).length > 0;
  const hasPromptTemplateObject = promptTemplateObject != null;

  return (
    <Flex direction="column" gap="size-200">
      {/* @ts-expect-error force putting the title in as a string */}
      <TabbedCard {...defaultCardProps} title={modelNameTitleEl}>
        <Tabs>
          {hasInputMessages ? (
            <TabPane name="Input Messages" hidden={!hasInputMessages}>
              <LLMMessagesList messages={inputMessages} />
            </TabPane>
          ) : null}
          {hasInput ? (
            <TabPane name="Input" hidden={!hasInput}>
              <CodeBlock {...input} />
            </TabPane>
          ) : null}
          {hasPromptTemplateObject ? (
            <TabPane name="Prompt Template" hidden={!hasPromptTemplateObject}>
              <View padding="size-200">
                <Flex direction="column" gap="size-100">
                  <View
                    borderRadius="medium"
                    borderColor="light"
                    backgroundColor="light"
                    borderWidth="thin"
                    padding="size-200"
                  >
                    <Text color="text-700" fontStyle="italic">
                      prompt template
                    </Text>
                    <CodeBlock
                      value={promptTemplateObject.template}
                      mimeType="text"
                    />
                  </View>
                  <View
                    borderRadius="medium"
                    borderColor="light"
                    backgroundColor="light"
                    borderWidth="thin"
                    padding="size-200"
                  >
                    <Text color="text-700" fontStyle="italic">
                      template variables
                    </Text>
                    <CodeBlock
                      value={JSON.stringify(promptTemplateObject.variables)}
                      mimeType="json"
                    />
                  </View>
                </Flex>
              </View>
            </TabPane>
          ) : null}
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
      {hasOutput || hasOutputMessages ? (
        <TabbedCard {...defaultCardProps}>
          <Tabs>
            {hasOutputMessages ? (
              <TabPane name="Output Messages" hidden={!hasOutputMessages}>
                <LLMMessagesList messages={outputMessages} />
              </TabPane>
            ) : null}
            {hasOutput ? (
              <TabPane name="Output" hidden={!hasOutput}>
                <CodeBlock {...output} />
              </TabPane>
            ) : null}
          </Tabs>
        </TabbedCard>
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
                    <DocumentItem
                      document={document}
                      borderColor={"seafoam-700"}
                      backgroundColor={"seafoam-100"}
                      labelColor="seafoam-1000"
                    />
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

function RerankerSpanInfo(props: {
  span: Span;
  spanAttributes: AttributeObject;
}) {
  const { spanAttributes } = props;
  const rerankerAttributes = useMemo<AttributeObject | null>(() => {
    const rerankerAttrs = spanAttributes[SemanticAttributePrefixes.reranker];
    if (typeof rerankerAttrs === "object") {
      return rerankerAttrs as AttributeObject;
    }
    return null;
  }, [spanAttributes]);
  const query = useMemo<string>(() => {
    if (rerankerAttributes == null) {
      return "";
    }
    return (rerankerAttributes[RerankerAttributePostfixes.query] ||
      "") as string;
  }, [rerankerAttributes]);
  const input_documents = useMemo<AttributeDocument[]>(() => {
    if (rerankerAttributes == null) {
      return [];
    }
    return (rerankerAttributes[RerankerAttributePostfixes.input_documents] ||
      []) as AttributeDocument[];
  }, [rerankerAttributes]);
  const output_documents = useMemo<AttributeDocument[]>(() => {
    if (rerankerAttributes == null) {
      return [];
    }
    return (rerankerAttributes[RerankerAttributePostfixes.output_documents] ||
      []) as AttributeDocument[];
  }, [rerankerAttributes]);

  const numInputDocuments = input_documents.length;
  const numOutputDocuments = output_documents.length;
  return (
    <Flex direction="column" gap="size-200">
      <Card title="Query" {...defaultCardProps}>
        <CodeBlock value={query} mimeType="text" />
      </Card>
      <Card
        title={"Input Documents"}
        titleExtra={<Counter variant="light">{numInputDocuments}</Counter>}
        {...defaultCardProps}
        defaultOpen={false}
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
            {input_documents.map((document, idx) => {
              return (
                <li key={idx}>
                  <DocumentItem
                    document={document}
                    borderColor={"seafoam-700"}
                    backgroundColor={"seafoam-100"}
                    labelColor="seafoam-1000"
                  />
                </li>
              );
            })}
          </ul>
        }
      </Card>
      <Card
        title={"Output Documents"}
        titleExtra={<Counter variant="light">{numOutputDocuments}</Counter>}
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
            {output_documents.map((document, idx) => {
              return (
                <li key={idx}>
                  <DocumentItem
                    document={document}
                    borderColor={"celery-700"}
                    backgroundColor={"celery-100"}
                    labelColor="celery-1000"
                  />
                </li>
              );
            })}
          </ul>
        }
      </Card>
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
                      backgroundColor="purple-100"
                      borderColor="purple-700"
                      borderWidth="thin"
                      borderRadius="medium"
                    >
                      <Text color="text-700" fontStyle="italic">
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
                <Text color="text-700" fontStyle="italic">
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
                <Text color="text-700" fontStyle="italic">
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

function DocumentItem({
  document,
  backgroundColor,
  borderColor,
  labelColor,
}: {
  document: AttributeDocument;
  backgroundColor: ViewProps["backgroundColor"];
  borderColor: ViewProps["borderColor"];
  labelColor: LabelProps["color"];
}) {
  const metadata = document[DOCUMENT_METADATA];
  return (
    <View
      borderRadius="medium"
      backgroundColor={backgroundColor}
      borderColor={borderColor}
      borderWidth="thin"
    >
      <Flex direction="column">
        <View
          width="100%"
          borderBottomWidth="thin"
          borderBottomColor={borderColor}
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
              <Label color={labelColor}>{`score ${numberFormatter(
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
        {metadata && (
          <>
            <View borderColor={borderColor} borderTopWidth="thin">
              <CodeBlock value={JSON.stringify(metadata)} mimeType="json" />
            </View>
          </>
        )}
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
        backgroundColor: "indigo-100",
        borderColor: "indigo-700",
      };
    } else if (["function", "tool"].includes(role)) {
      return {
        backgroundColor: "yellow-100",
        borderColor: "yellow-700",
      };
    }
    return {
      backgroundColor: "gray-600",
      borderColor: "gray-400",
    };
  }, [role]);

  return (
    <View
      borderWidth="thin"
      borderRadius="medium"
      padding="size-200"
      {...messageStyles}
    >
      <Flex direction="column" alignItems="start">
        <Text color="text-700" fontStyle="italic">
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
    <ul
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--ac-global-dimension-static-size-100);
        padding: var(--ac-global-dimension-static-size-200);
      `}
    >
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
  const isMissingIO = input == null && output == null;
  return (
    <Flex direction="column" gap="size-200">
      {input && input.value != null ? (
        <Card title="Input" {...defaultCardProps}>
          <CodeBlock {...input} />
        </Card>
      ) : null}
      {output && output.value != null ? (
        <Card
          title="Output"
          {...defaultCardProps}
          backgroundColor="green-100"
          borderColor="green-700"
        >
          <CodeBlock {...output} />
        </Card>
      ) : null}
      {isMissingIO ? (
        <Card
          title="All Attributes"
          titleExtra={attributesContextualHelp}
          {...defaultCardProps}
        >
          <CodeBlock value={span.attributes} mimeType="json" />
        </Card>
      ) : null}
    </Flex>
  );
}

const codeMirrorCSS = css`
  .cm-content {
    padding: var(--ac-global-dimension-static-size-100) 0;
  }
  .cm-editor,
  .cm-gutters {
    background-color: transparent;
  }
`;
function CodeBlock({ value, mimeType }: { value: string; mimeType: MimeType }) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? undefined : nord;
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
            highlightActiveLineGutter: false,
          }}
          extensions={[json(), EditorView.lineWrapping]}
          editable={false}
          theme={codeMirrorTheme}
          css={codeMirrorCSS}
        />
      );
      break;
    case "text":
      content = (
        <CodeMirror
          value={value}
          theme={codeMirrorTheme}
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
                <Text color="text-700">{event.message}</Text>
              </Flex>
              <View>
                <Text color="text-700">
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
