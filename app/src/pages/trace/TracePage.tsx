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
  Alert,
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
  MESSAGE_TOOL_CALLS,
  RerankerAttributePostfixes,
  RetrievalAttributePostfixes,
  SemanticAttributePrefixes,
  TOOL_CALL_FUNCTION_ARGUMENTS_JSON,
  TOOL_CALL_FUNCTION_NAME,
  ToolAttributePostfixes,
} from "@arizeai/openinference-semantic-conventions";

import { CopyToClipboardButton, ExternalLink } from "@phoenix/components";
import { resizeHandleCSS } from "@phoenix/components/resize";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanItem } from "@phoenix/components/trace/SpanItem";
import { SpanKindIcon } from "@phoenix/components/trace/SpanKindIcon";
import { SpanStatusCodeIcon } from "@phoenix/components/trace/SpanStatusCodeIcon";
import { TraceTree } from "@phoenix/components/trace/TraceTree";
import { useSpanStatusCodeColor } from "@phoenix/components/trace/useSpanStatusCodeColor";
import { useTheme } from "@phoenix/contexts";
import {
  ConnectedMarkdownBlock,
  MarkdownDisplayProvider,
} from "@phoenix/markdown";
import { ConnectedMarkdownModeRadioGroup } from "@phoenix/markdown/MarkdownModeRadioGroup";
import {
  AttributeDocument,
  AttributeEmbedding,
  AttributeMessage,
  AttributePromptTemplate,
} from "@phoenix/openInference/tracing/types";
import { assertUnreachable, isStringArray } from "@phoenix/typeUtils";
import { formatFloat, numberFormatter } from "@phoenix/utils/numberFormatUtils";

import { EvaluationLabel } from "../project/EvaluationLabel";
import { RetrievalEvaluationLabel } from "../project/RetrievalEvaluationLabel";

import {
  MimeType,
  TracePageQuery,
  TracePageQuery$data,
} from "./__generated__/TracePageQuery.graphql";
import { SpanEvaluationsTable } from "./SpanEvaluationsTable";

type Span = NonNullable<
  TracePageQuery$data["project"]["trace"]
>["spans"]["edges"][number]["span"];
type DocumentEvaluation = Span["documentEvaluations"][number];
/**
 * A span attribute object that is a map of string to an unknown value
 */
type AttributeObject = Record<string, unknown>;

/**
 * Hook that safely parses a JSON string.
 */
const useSafelyParsedJSON = (
  jsonStr: string
): { json: { [key: string]: unknown } | null; parseError?: unknown } => {
  return useMemo(() => {
    try {
      return { json: JSON.parse(jsonStr) };
    } catch (e) {
      return { json: null, parseError: e };
    }
  }, [jsonStr]);
};

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
  variant: "compact",
  collapsible: true,
};

/**
 * A root span is defined to be a span whose parent span is not in our collection.
 * But if more than one such span exists, return null.
 */
function findRootSpan(spansList: Span[]): Span | null {
  // If there is a span whose parent is null, then it is the root span.
  const rootSpan = spansList.find((span) => span.parentId == null);
  if (rootSpan) return rootSpan;
  // Otherwise we need to find all spans whose parent span is not in our collection.
  const spanIds = new Set(spansList.map((span) => span.context.spanId));
  const rootSpans = spansList.filter(
    (span) => span.parentId != null && !spanIds.has(span.parentId)
  );
  // If only one such span exists, then return it, otherwise, return null.
  if (rootSpans.length === 1) return rootSpans[0];
  return null;
}

/**
 * A page that shows the details of a trace (e.g. a collection of spans)
 */
export function TracePage() {
  const { traceId, projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const data = useLazyLoadQuery<TracePageQuery>(
    graphql`
      query TracePageQuery($traceId: ID!, $id: GlobalID!) {
        project: node(id: $id) {
          ... on Project {
            trace(traceId: $traceId) {
              spans(first: 1000) {
                edges {
                  span: node {
                    context {
                      spanId
                    }
                    name
                    spanKind
                    statusCode: propagatedStatusCode
                    statusMessage
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
                    spanEvaluations {
                      name
                      label
                      score
                    }
                    documentRetrievalMetrics {
                      evaluationName
                      ndcg
                      precision
                      hit
                    }
                    documentEvaluations {
                      documentPosition
                      name
                      label
                      score
                      explanation
                    }
                    ...SpanEvaluationsTable_evals
                  }
                }
              }
            }
          }
        }
      }
    `,
    { traceId: traceId as string, id: projectId as string },
    {
      fetchPolicy: "store-and-network",
    }
  );
  const spansList: Span[] = useMemo(() => {
    const gqlSpans = data.project.trace?.spans.edges || [];
    return gqlSpans.map((node) => node.span);
  }, [data]);
  const urlSelectedSpanId = searchParams.get("selectedSpanId");
  const selectedSpanId = urlSelectedSpanId ?? spansList[0].context.spanId;
  const selectedSpan = spansList.find(
    (span) => span.context.spanId === selectedSpanId
  );
  const rootSpan = useMemo(() => findRootSpan(spansList), [spansList]);

  return (
    <DialogContainer
      type="slideOver"
      isDismissable
      onDismiss={() => navigate(`/projects/${projectId}`)}
    >
      <Dialog size="fullscreen" title="Trace Details">
        <main
          css={css`
            flex: 1 1 auto;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          `}
        >
          <TraceHeader rootSpan={rootSpan} />
          <PanelGroup
            direction="horizontal"
            autoSaveId="trace-panel-group"
            css={css`
              flex: 1 1 auto;
              overflow: hidden;
            `}
          >
            <Panel defaultSize={30} minSize={10} maxSize={40}>
              <ScrollingPanelContent>
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
              </ScrollingPanelContent>
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

function TraceHeader({ rootSpan }: { rootSpan: Span | null }) {
  const { latencyMs, statusCode, spanEvaluations } = rootSpan ?? {
    latencyMs: null,
    statusCode: "UNSET",
    spanEvaluations: [],
  };
  const statusColor = useSpanStatusCodeColor(statusCode);
  const hasEvaluations = spanEvaluations.length;
  return (
    <View padding="size-200" borderBottomWidth="thin" borderBottomColor="dark">
      <Flex direction="row" gap="size-400">
        <Flex direction="column">
          <Text elementType="h3" textSize="medium" color="text-700">
            Trace Status
          </Text>
          <Text textSize="xlarge">
            <Flex direction="row" gap="size-50" alignItems="center">
              <SpanStatusCodeIcon statusCode={statusCode} />
              <Text textSize="xlarge" color={statusColor}>
                {statusCode}
              </Text>
            </Flex>
          </Text>
        </Flex>
        <Flex direction="column">
          <Text elementType="h3" textSize="medium" color="text-700">
            Latency
          </Text>
          <Text textSize="xlarge">
            {typeof latencyMs === "number" ? (
              <LatencyText latencyMs={latencyMs} textSize="xlarge" />
            ) : (
              "--"
            )}
          </Text>
        </Flex>
        {hasEvaluations ? (
          <Flex direction="column" gap="size-50">
            <Text elementType="h3" textSize="medium" color="text-700">
              Evaluations
            </Text>
            <Flex direction="row" gap="size-50">
              {spanEvaluations.map((evaluation) => {
                return (
                  <EvaluationLabel
                    key={evaluation.name}
                    evaluation={evaluation}
                  />
                );
              })}
            </Flex>
          </Flex>
        ) : null}
      </Flex>
    </View>
  );
}

function ScrollingTabsWrapper({ children }: PropsWithChildren) {
  return (
    <div
      data-testid="scrolling-tabs-wrapper"
      css={css`
        height: 100%;
        overflow: hidden;
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

function ScrollingPanelContent({ children }: PropsWithChildren) {
  return (
    <div
      data-testid="scrolling-panel-content"
      css={css`
        height: 100%;
        overflow-y: auto;
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
        <TabPane
          name={"Evaluations"}
          extra={
            <Counter variant={"light"}>
              {selectedSpan.spanEvaluations.length}
            </Counter>
          }
        >
          {(selected) => {
            return selected ? <SpanEvaluations span={selectedSpan} /> : null;
          }}
        </TabPane>
        <TabPane name={"Attributes"} title="Attributes">
          <View padding="size-200">
            <Card
              title="All Attributes"
              {...defaultCardProps}
              titleExtra={attributesContextualHelp}
              extra={<CopyToClipboardButton text={selectedSpan.attributes} />}
            >
              <JSONBlock>{selectedSpan.attributes}</JSONBlock>
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
  const { json: attributesObject, parseError } =
    useSafelyParsedJSON(attributes);

  const statusDescription = useMemo(() => {
    return span.statusMessage ? (
      <Alert variant="danger" title="Status Description">
        {span.statusMessage}
      </Alert>
    ) : null;
  }, [span]);

  // Handle the case where the attributes are not a valid JSON object
  if (parseError || !attributesObject) {
    return (
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          {statusDescription}
          <Alert variant="warning" title="Un-parsable attributes">
            {`Failed to parse span attributes. ${parseError instanceof Error ? parseError.message : ""}`}
          </Alert>
          <Card {...defaultCardProps} title="Attributes">
            <View padding="size-100">{attributes}</View>
          </Card>
        </Flex>
      </View>
    );
  }

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

  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-200">
        {statusDescription}
        {content}
        {attributesObject?.metadata ? (
          <Card {...defaultCardProps} title="Metadata">
            <JSONBlock>{JSON.stringify(attributesObject.metadata)}</JSONBlock>
          </Card>
        ) : null}
      </Flex>
    </View>
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
      <Card
        collapsible
        backgroundColor="light"
        borderColor="light"
        bodyStyle={{
          padding: 0,
        }}
        titleSeparator={false}
        variant="compact"
        // @ts-expect-error force putting the title in as a string
        title={modelNameTitleEl}
      >
        <Tabs>
          {hasInputMessages ? (
            <TabPane name="Input Messages" hidden={!hasInputMessages}>
              <LLMMessagesList messages={inputMessages} />
            </TabPane>
          ) : null}
          {hasInput ? (
            <TabPane name="Input" hidden={!hasInput}>
              <View padding="size-200">
                <MarkdownDisplayProvider>
                  <Card
                    {...defaultCardProps}
                    title="LLM Input"
                    extra={
                      <Flex direction="row" gap="size-100">
                        <ConnectedMarkdownModeRadioGroup />
                        <CopyToClipboardButton text={input.value} />
                      </Flex>
                    }
                  >
                    <CodeBlock {...input} />
                  </Card>
                </MarkdownDisplayProvider>
              </View>
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
                    <CopyToClipboard text={promptTemplateObject.template}>
                      <Text color="text-700" fontStyle="italic">
                        prompt template
                      </Text>
                      <PreBlock>{promptTemplateObject.template}</PreBlock>
                    </CopyToClipboard>
                  </View>
                  <View
                    borderRadius="medium"
                    borderColor="light"
                    backgroundColor="light"
                    borderWidth="thin"
                    padding="size-200"
                  >
                    <CopyToClipboard
                      text={JSON.stringify(promptTemplateObject.variables)}
                    >
                      <Text color="text-700" fontStyle="italic">
                        template variables
                      </Text>
                      <JSONBlock>
                        {JSON.stringify(promptTemplateObject.variables)}
                      </JSONBlock>
                    </CopyToClipboard>
                  </View>
                </Flex>
              </View>
            </TabPane>
          ) : null}
          <TabPane name="Prompts" hidden={!hasPrompts}>
            <LLMPromptsList prompts={prompts} />
          </TabPane>
          <TabPane name="Invocation Params" hidden={!hasInvocationParams}>
            <CopyToClipboard
              text={invocation_parameters_str}
              padding="size-100"
            >
              <JSONBlock>{invocation_parameters_str}</JSONBlock>
            </CopyToClipboard>
          </TabPane>
        </Tabs>
      </Card>
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
                <View padding="size-200">
                  <MarkdownDisplayProvider>
                    <Card
                      {...defaultCardProps}
                      title="LLM Output"
                      extra={
                        <Flex direction="row" gap="size-100">
                          <ConnectedMarkdownModeRadioGroup />
                          <CopyToClipboardButton text={output.value} />
                        </Flex>
                      }
                    >
                      <CodeBlock {...output} />
                    </Card>
                  </MarkdownDisplayProvider>
                </View>
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

  // Construct a map of document position to document evaluations
  const documentEvaluationsMap = useMemo<
    Record<number, DocumentEvaluation[]>
  >(() => {
    const documentEvaluations = span.documentEvaluations;
    return documentEvaluations.reduce(
      (acc, documentEvaluation) => {
        const documentPosition = documentEvaluation.documentPosition;
        const evaluations = acc[documentPosition] || [];
        return {
          ...acc,
          [documentPosition]: [...evaluations, documentEvaluation],
        };
      },
      {} as Record<number, DocumentEvaluation[]>
    );
  }, [span.documentEvaluations]);

  const hasInput = input != null && input.value != null;
  const hasDocuments = documents.length > 0;
  const hasDocumentRetrievalMetrics = span.documentRetrievalMetrics.length > 0;
  return (
    <Flex direction="column" gap="size-200">
      {hasInput ? (
        <MarkdownDisplayProvider>
          <Card
            title="Input"
            {...defaultCardProps}
            extra={
              <Flex direction="row" gap="size-100">
                <ConnectedMarkdownModeRadioGroup />
                <CopyToClipboardButton text={input.value} />
              </Flex>
            }
          >
            <CodeBlock {...input} />
          </Card>
        </MarkdownDisplayProvider>
      ) : null}
      {hasDocuments ? (
        <MarkdownDisplayProvider initialMode="markdown">
          <Card
            title="Documents"
            {...defaultCardProps}
            titleExtra={
              hasDocumentRetrievalMetrics && (
                <Flex direction="row" alignItems="center" gap="size-100">
                  {span.documentRetrievalMetrics.map((retrievalMetric) => {
                    return (
                      <>
                        <RetrievalEvaluationLabel
                          key="ndcg"
                          name={retrievalMetric.evaluationName}
                          metric="ndcg"
                          score={retrievalMetric.ndcg}
                        />
                        <RetrievalEvaluationLabel
                          key="precision"
                          name={retrievalMetric.evaluationName}
                          metric="precision"
                          score={retrievalMetric.precision}
                        />
                        <RetrievalEvaluationLabel
                          key="hit"
                          name={retrievalMetric.evaluationName}
                          metric="hit"
                          score={retrievalMetric.hit}
                        />
                      </>
                    );
                  })}
                </Flex>
              )
            }
            extra={<ConnectedMarkdownModeRadioGroup />}
          >
            <ul
              css={css`
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
                      documentEvaluations={documentEvaluationsMap[idx]}
                      borderColor={"seafoam-700"}
                      backgroundColor={"seafoam-100"}
                      labelColor="seafoam-1000"
                    />
                  </li>
                );
              })}
            </ul>
          </Card>
        </MarkdownDisplayProvider>
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
      <MarkdownDisplayProvider>
        <Card title="Query" {...defaultCardProps}>
          <ConnectedMarkdownBlock>{query}</ConnectedMarkdownBlock>
        </Card>
      </MarkdownDisplayProvider>
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
                display: flex;
                flex-direction: column;
                gap: var(--ac-global-dimension-static-size-200);
              `}
            >
              {embeddings.map((embedding, idx) => {
                return (
                  <li key={idx}>
                    <MarkdownDisplayProvider>
                      <Card
                        {...defaultCardProps}
                        backgroundColor="purple-100"
                        borderColor="purple-700"
                        title="Embedded Text"
                      >
                        <ConnectedMarkdownBlock>
                          {embedding[EMBEDDING_TEXT] || ""}
                        </ConnectedMarkdownBlock>
                      </Card>
                    </MarkdownDisplayProvider>
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
                <JSONBlock>
                  {JSON.stringify(toolParameters) as string}
                </JSONBlock>
              </Flex>
            </View>
          ) : null}
        </Flex>
      </Card>
    </Flex>
  );
}

// Labels that get highlighted as danger in the document evaluations
const DANGER_DOCUMENT_EVALUATION_LABELS = ["irrelevant", "unrelated"];
function DocumentItem({
  document,
  documentEvaluations,
  backgroundColor,
  borderColor,
  labelColor,
}: {
  document: AttributeDocument;
  documentEvaluations?: DocumentEvaluation[] | null;
  backgroundColor: ViewProps["backgroundColor"];
  borderColor: ViewProps["borderColor"];
  labelColor: LabelProps["color"];
}) {
  const metadata = document[DOCUMENT_METADATA];
  const hasEvaluations = documentEvaluations && documentEvaluations.length;
  return (
    <Card
      {...defaultCardProps}
      backgroundColor={backgroundColor}
      borderColor={borderColor}
      bodyStyle={{
        padding: 0,
      }}
      // @ts-expect-error force putting the title in as a string
      title={
        <Flex direction="row" gap="size-50" alignItems="center">
          <Icon svg={<Icons.FileOutline />} />
          <Heading level={4}>document {document[DOCUMENT_ID]}</Heading>
        </Flex>
      }
      extra={
        typeof document[DOCUMENT_SCORE] === "number" && (
          <Label color={labelColor}>{`score ${numberFormatter(
            document[DOCUMENT_SCORE]
          )}`}</Label>
        )
      }
    >
      <Flex direction="column">
        <View padding="size-200">
          <ConnectedMarkdownBlock>
            {document[DOCUMENT_CONTENT]}
          </ConnectedMarkdownBlock>
        </View>
        {metadata && (
          <>
            <View borderColor={borderColor} borderTopWidth="thin">
              <JSONBlock>{JSON.stringify(metadata)}</JSONBlock>
            </View>
          </>
        )}
        {hasEvaluations && (
          <View
            borderColor={borderColor}
            borderTopWidth="thin"
            padding="size-200"
          >
            <Flex direction="column" gap="size-100">
              <Heading level={3} weight="heavy">
                Evaluations
              </Heading>
              <ul>
                {documentEvaluations.map((documentEvaluation, idx) => {
                  // Highlight the label as danger if it is a danger classification
                  const evalLabelColor =
                    documentEvaluation.label &&
                    DANGER_DOCUMENT_EVALUATION_LABELS.includes(
                      documentEvaluation.label
                    )
                      ? "danger"
                      : labelColor;
                  return (
                    <li key={idx}>
                      <View
                        padding="size-200"
                        borderWidth="thin"
                        borderColor={borderColor}
                        borderRadius="medium"
                      >
                        <Flex direction="column" gap="size-50">
                          <Flex direction="row" gap="size-100">
                            <Text weight="heavy" elementType="h5">
                              {documentEvaluation.name}
                            </Text>
                            {documentEvaluation.label && (
                              <Label color={evalLabelColor} shape="badge">
                                {documentEvaluation.label}
                              </Label>
                            )}
                            {typeof documentEvaluation.score === "number" && (
                              <Label color={evalLabelColor} shape="badge">
                                <Flex direction="row" gap="size-50">
                                  <Text
                                    textSize="xsmall"
                                    weight="heavy"
                                    color="inherit"
                                  >
                                    score
                                  </Text>
                                  <Text textSize="xsmall">
                                    {formatFloat(documentEvaluation.score)}
                                  </Text>
                                </Flex>
                              </Label>
                            )}
                          </Flex>
                          {typeof documentEvaluation.explanation && (
                            <p
                              css={css`
                                margin-top: var(
                                  --ac-global-dimension-static-size-100
                                );
                                margin-bottom: 0;
                              `}
                            >
                              {documentEvaluation.explanation}
                            </p>
                          )}
                        </Flex>
                      </View>
                    </li>
                  );
                })}
              </ul>
            </Flex>
          </View>
        )}
      </Flex>
    </Card>
  );
}

function LLMMessage({ message }: { message: AttributeMessage }) {
  const messageContent = message[MESSAGE_CONTENT];
  const toolCalls = message[MESSAGE_TOOL_CALLS] || [];
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
    <MarkdownDisplayProvider>
      <Card
        {...defaultCardProps}
        {...messageStyles}
        title={
          role + (message[MESSAGE_NAME] ? `: ${message[MESSAGE_NAME]}` : "")
        }
        extra={
          <Flex direction="row" gap="size-100">
            <ConnectedMarkdownModeRadioGroup />
            <CopyToClipboardButton
              text={messageContent || JSON.stringify(message)}
            />
          </Flex>
        }
      >
        <Flex direction="column" alignItems="start">
          {messageContent ? (
            <ConnectedMarkdownBlock>
              {message[MESSAGE_CONTENT]}
            </ConnectedMarkdownBlock>
          ) : null}
          {toolCalls.length > 0
            ? toolCalls.map((toolCall, idx) => {
                return (
                  <pre
                    key={idx}
                    css={css`
                      text-wrap: wrap;
                      margin: var(--ac-global-dimension-static-size-100) 0;
                    `}
                  >
                    {toolCall[TOOL_CALL_FUNCTION_NAME] as string}(
                    {JSON.stringify(
                      JSON.parse(
                        toolCall[TOOL_CALL_FUNCTION_ARGUMENTS_JSON] as string
                      ),
                      null,
                      2
                    )}
                    )
                  </pre>
                );
              })
            : null}
          {/*functionCall is deprecated and is superseded by toolCalls, so we don't expect both to be present*/}
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
      </Card>
    </MarkdownDisplayProvider>
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
              <CopyToClipboard text={prompt}>
                <CodeBlock value={prompt} mimeType="text" />
              </CopyToClipboard>
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
  const inputIsText = input?.mimeType === "text";
  const outputIsText = output?.mimeType === "text";
  return (
    <Flex direction="column" gap="size-200">
      {input && input.value != null ? (
        <MarkdownDisplayProvider>
          <Card
            title="Input"
            {...defaultCardProps}
            extra={
              <Flex direction="row" gap="size-100">
                {inputIsText ? <ConnectedMarkdownModeRadioGroup /> : null}
                <CopyToClipboardButton text={input.value} />
              </Flex>
            }
          >
            <CodeBlock {...input} />
          </Card>
        </MarkdownDisplayProvider>
      ) : null}
      {output && output.value != null ? (
        <MarkdownDisplayProvider>
          <Card
            title="Output"
            {...defaultCardProps}
            backgroundColor="green-100"
            borderColor="green-700"
            extra={
              <Flex direction="row" gap="size-100">
                {outputIsText ? <ConnectedMarkdownModeRadioGroup /> : null}
                <CopyToClipboardButton text={output.value} />
              </Flex>
            }
          >
            <CodeBlock {...output} />
          </Card>
        </MarkdownDisplayProvider>
      ) : null}
      {isMissingIO ? (
        <Card
          title="All Attributes"
          titleExtra={attributesContextualHelp}
          {...defaultCardProps}
          extra={<CopyToClipboardButton text={span.attributes} />}
        >
          <JSONBlock>{span.attributes}</JSONBlock>
        </Card>
      ) : null}
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

function CopyToClipboard({
  text,
  children,
  padding,
}: PropsWithChildren<{ text: string; padding?: "size-100" }>) {
  const paddingValue = padding ? `var(--ac-global-dimension-${padding})` : "0";
  return (
    <div
      css={css`
        position: relative;
        .copy-to-clipboard-button {
          transition: opacity 0.2s ease-in-out;
          opacity: 0;
          position: absolute;
          right: ${paddingValue};
          top: ${paddingValue};
          z-index: 1;
        }
        &:hover .copy-to-clipboard-button {
          opacity: 1;
        }
      `}
    >
      <CopyToClipboardButton text={text} />
      {children}
    </div>
  );
}
/**
 * A block of JSON content that is not editable.
 */
function JSONBlock({ children }: { children: string }) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? undefined : nord;
  // We need to make sure that the content can actually be displayed
  // As JSON as we cannot fully trust the backend to always send valid JSON
  const { value, mimeType } = useMemo(() => {
    try {
      // Attempt to pretty print the JSON. This may fail if the JSON is invalid.
      // E.g. sometimes it contains NANs due to poor JSON.dumps in the backend
      return {
        value: JSON.stringify(JSON.parse(children), null, 2),
        mimeType: "json" as const,
      };
    } catch (e) {
      // Fall back to string
      return { value: children, mimeType: "text" as const };
    }
  }, [children]);
  if (mimeType === "json") {
    return (
      <CodeMirror
        value={children}
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
  } else {
    return <PreBlock>{value}</PreBlock>;
  }
}

function PreBlock({ children }: { children: string }) {
  return (
    <pre
      css={css`
        white-space: pre-wrap;
        padding: 0;
      `}
    >
      {children}
    </pre>
  );
}

function CodeBlock({ value, mimeType }: { value: string; mimeType: MimeType }) {
  let content;
  switch (mimeType) {
    case "json":
      content = <JSONBlock>{value}</JSONBlock>;
      break;
    case "text":
      content = <ConnectedMarkdownBlock>{value}</ConnectedMarkdownBlock>;
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
              <View flex="none">
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

function SpanEvaluations(props: { span: Span }) {
  return <SpanEvaluationsTable span={props.span} />;
}
