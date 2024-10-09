import React, {
  PropsWithChildren,
  ReactNode,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useNavigate } from "react-router";
import { json } from "@codemirror/lang-json";
import { nord } from "@uiw/codemirror-theme-nord";
import { EditorView } from "@uiw/react-codemirror";
import CodeMirror from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import {
  Alert,
  Button,
  Card,
  CardProps,
  Content,
  ContextualHelp,
  Counter,
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
  Tooltip,
  TooltipTrigger,
  View,
  ViewProps,
} from "@arizeai/components";
import {
  DocumentAttributePostfixes,
  EmbeddingAttributePostfixes,
  LLMAttributePostfixes,
  MessageAttributePostfixes,
  RerankerAttributePostfixes,
  RetrievalAttributePostfixes,
  SemanticAttributePrefixes,
  ToolAttributePostfixes,
} from "@arizeai/openinference-semantic-conventions";

import { CopyToClipboardButton, ExternalLink } from "@phoenix/components";
import { ErrorBoundary } from "@phoenix/components/ErrorBoundary";
import {
  ConnectedMarkdownBlock,
  ConnectedMarkdownModeRadioGroup,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import { SpanKindIcon } from "@phoenix/components/trace";
import { SpanKindLabel } from "@phoenix/components/trace/SpanKindLabel";
import { useNotifySuccess, useTheme } from "@phoenix/contexts";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import {
  AttributeDocument,
  AttributeEmbedding,
  AttributeEmbeddingEmbedding,
  AttributeLlm,
  AttributeLLMToolDefinition,
  AttributeMessage,
  AttributeMessageContent,
  AttributePromptTemplate,
  AttributeReranker,
  AttributeRetrieval,
  AttributeTool,
  isAttributeMessages,
} from "@phoenix/openInference/tracing/types";
import { assertUnreachable, isStringArray } from "@phoenix/typeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";
import { formatFloat, numberFormatter } from "@phoenix/utils/numberFormatUtils";

import { RetrievalEvaluationLabel } from "../project/RetrievalEvaluationLabel";

import {
  MimeType,
  SpanDetailsQuery,
  SpanDetailsQuery$data,
} from "./__generated__/SpanDetailsQuery.graphql";
import { EditSpanAnnotationsButton } from "./EditSpanAnnotationsButton";
import { SpanAside } from "./SpanAside";
import { SpanCodeDropdown } from "./SpanCodeDropdown";
import { SpanFeedback } from "./SpanFeedback";
import { SpanImage } from "./SpanImage";
import { SpanToDatasetExampleDialog } from "./SpanToDatasetExampleDialog";

/**
 * A span attribute object that is a map of string to an unknown value
 */
type AttributeObject = {
  [SemanticAttributePrefixes.retrieval]?: AttributeRetrieval;
  [SemanticAttributePrefixes.embedding]?: AttributeEmbedding;
  [SemanticAttributePrefixes.tool]?: AttributeTool;
  [SemanticAttributePrefixes.reranker]?: AttributeReranker;
  [SemanticAttributePrefixes.llm]?: AttributeLlm;
};

type Span = Extract<SpanDetailsQuery$data["span"], { __typename: "Span" }>;

type DocumentEvaluation = NonNullable<Span["documentEvaluations"]>[number];

/**
 * Hook that safely parses a JSON string.
 */
const useSafelyParsedJSON = (
  jsonStr: string
): { json: { [key: string]: unknown } | null; parseError?: unknown } => {
  return useMemo(() => {
    return safelyParseJSON(jsonStr);
  }, [jsonStr]);
};

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

export function SpanDetails({
  spanNodeId,
  projectId,
}: {
  /**
   * The Global ID of the span
   */
  spanNodeId: string;
  projectId: string;
}) {
  const isPromptPlaygroundEnabled = useFeatureFlag("playground");
  const navigate = useNavigate();
  const { span } = useLazyLoadQuery<SpanDetailsQuery>(
    graphql`
      query SpanDetailsQuery($spanId: GlobalID!) {
        span: node(id: $spanId) {
          __typename
          ... on Span {
            id
            context {
              spanId
              traceId
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
            events @required(action: THROW) {
              name
              message
              timestamp
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
            spanAnnotations {
              name
            }
            ...SpanFeedback_annotations
            ...SpanAside_span
          }
        }
      }
    `,
    {
      spanId: spanNodeId,
    }
  );

  if (span.__typename !== "Span") {
    throw new Error(
      "Expected a span, but got a different type" + span.__typename
    );
  }

  const hasExceptions = useMemo<boolean>(() => {
    return spanHasException(span);
  }, [span]);
  const showSpanAside = usePreferencesContext((store) => store.showSpanAside);
  const setShowSpanAside = usePreferencesContext(
    (store) => store.setShowSpanAside
  );
  return (
    <Flex direction="column" flex="1 1 auto" height="100%">
      <View
        paddingTop="size-100"
        paddingBottom="size-100"
        paddingStart="size-150"
        paddingEnd="size-200"
        flex="none"
      >
        <Flex direction="row" gap="size-200" alignItems="center">
          <Flex
            direction="row"
            gap="size-100"
            width="100%"
            height="100%"
            alignItems="center"
          >
            <SpanKindLabel spanKind={span.spanKind} />
            <Text>{span.name}</Text>
          </Flex>
          <Flex flex="none" direction="row" alignItems="center" gap="size-100">
            {isPromptPlaygroundEnabled ? (
              <Button
                variant="default"
                icon={<Icon svg={<Icons.PlayCircleOutline />} />}
                disabled={span.spanKind !== "llm"}
                onClick={() => {
                  navigate(`/playground/spans/${span.id}`);
                }}
              >
                Playground
              </Button>
            ) : null}
            <SpanCodeDropdown
              traceId={span.context.traceId}
              spanId={span.context.spanId}
            />
            <AddSpanToDatasetButton span={span} />
            <EditSpanAnnotationsButton
              spanNodeId={span.id}
              projectId={projectId}
            />
            <TooltipTrigger placement="top" offset={5}>
              <Button
                variant="default"
                aria-label="Toggle showing span details"
                onClick={() => {
                  setShowSpanAside(!showSpanAside);
                }}
                icon={
                  <Icon
                    svg={showSpanAside ? <Icons.SlideIn /> : <Icons.SlideOut />}
                  />
                }
              />
              <Tooltip>
                {showSpanAside ? "Hide Span Details" : "Show Span Details"}
              </Tooltip>
            </TooltipTrigger>
          </Flex>
        </Flex>
      </View>
      <Tabs>
        <TabPane name={"Info"}>
          <Flex direction="row" height="100%">
            <SpanInfoWrap>
              <ErrorBoundary>
                <SpanInfo span={span} />
              </ErrorBoundary>
            </SpanInfoWrap>
            {showSpanAside ? <SpanAside span={span} /> : null}
          </Flex>
        </TabPane>
        <TabPane
          name={"Feedback"}
          extra={
            <Counter variant={"light"}>{span.spanAnnotations.length}</Counter>
          }
        >
          {(selected) => {
            return selected ? <SpanFeedback span={span} /> : null;
          }}
        </TabPane>
        <TabPane name={"Attributes"} title="Attributes">
          <View padding="size-200">
            <Card
              title="All Attributes"
              {...defaultCardProps}
              titleExtra={attributesContextualHelp}
              extra={<CopyToClipboardButton text={span.attributes} />}
              bodyStyle={{ padding: 0 }}
            >
              <JSONBlock>{span.attributes}</JSONBlock>
            </Card>
          </View>
        </TabPane>
        <TabPane
          name={"Events"}
          extra={
            <Counter variant={hasExceptions ? "danger" : "light"}>
              {span.events.length}
            </Counter>
          }
        >
          <SpanEventsList events={span.events} />
        </TabPane>
      </Tabs>
    </Flex>
  );
}

const spanInfoWrapCSS = css`
  flex: 1 1 auto;
  overflow-y: auto;
  // Overflow fails to take into account padding
  & > *:after {
    content: "";
    display: block;
    height: var(--ac-global-dimension-static-size-400);
  }
`;

/**
 * A wrapper for the span info to style it with the appropriate overflow
 */
function SpanInfoWrap({ children }: PropsWithChildren) {
  return (
    <div css={spanInfoWrapCSS} data-testid="span-info-wrap">
      {children}
    </div>
  );
}

function AddSpanToDatasetButton({ span }: { span: Span }) {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const notifySuccess = useNotifySuccess();
  const navigate = useNavigate();
  const onAddSpanToDataset = useCallback(() => {
    setDialog(
      <SpanToDatasetExampleDialog
        spanId={span.id}
        onCompleted={(datasetId) => {
          setDialog(null);
          notifySuccess({
            title: "Span Added to Dataset",
            message: "Successfully added span to dataset",
            action: {
              text: "View Dataset",
              onClick: () => {
                navigate(`/datasets/${datasetId}/examples`);
              },
            },
          });
        }}
      />
    );
  }, [span.id, notifySuccess, navigate]);
  return (
    <>
      <Button
        variant="default"
        icon={<Icon svg={<Icons.DatabaseOutline />} />}
        onClick={onAddSpanToDataset}
      >
        Add to Dataset
      </Button>
      <Suspense>
        <DialogContainer
          type="slideOver"
          isDismissable
          onDismiss={() => setDialog(null)}
        >
          {dialog}
        </DialogContainer>
      </Suspense>
    </>
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
  const llmAttributes = useMemo<AttributeLlm | null>(
    () => spanAttributes[SemanticAttributePrefixes.llm] || null,
    [spanAttributes]
  );

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
    const inputMessagesValue =
      llmAttributes[LLMAttributePostfixes.input_messages];

    // At this point, we cannot trust the type of outputMessagesValue
    if (!isAttributeMessages(inputMessagesValue)) {
      return [];
    }

    return (inputMessagesValue
      ?.map((obj) => obj[SemanticAttributePrefixes.message])
      .filter(Boolean) || []) as AttributeMessage[];
  }, [llmAttributes]);

  const llmTools = useMemo<AttributeLLMToolDefinition[]>(() => {
    if (llmAttributes == null) {
      return [];
    }
    const tools = llmAttributes[LLMAttributePostfixes.tools];
    if (!Array.isArray(tools)) {
      return [];
    }
    const toolDefinitions = tools
      ?.map((obj) => obj[SemanticAttributePrefixes.tool])
      .filter(Boolean) as AttributeLLMToolDefinition[];
    return toolDefinitions;
  }, [llmAttributes]);

  const llmToolSchemas = useMemo<string[]>(() => {
    return llmTools.reduce((acc, tool) => {
      if (tool?.json_schema) {
        acc.push(tool.json_schema);
      }
      return acc;
    }, [] as string[]);
  }, [llmTools]);

  const outputMessages = useMemo<AttributeMessage[]>(() => {
    if (llmAttributes == null) {
      return [];
    }
    const outputMessagesValue =
      llmAttributes[LLMAttributePostfixes.output_messages];

    // At this point, we cannot trust the type of outputMessagesValue
    if (!isAttributeMessages(outputMessagesValue)) {
      return [];
    }
    return (outputMessagesValue
      .map((obj) => obj[SemanticAttributePrefixes.message])
      .filter(Boolean) || []) as AttributeMessage[];
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
    if (maybePromptTemplate == null) {
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
  const hasLLMToolSchemas = llmToolSchemas.length > 0;
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
        title={modelNameTitleEl}
      >
        <Tabs>
          {hasInputMessages ? (
            <TabPane name="Input Messages" hidden={!hasInputMessages}>
              <LLMMessagesList messages={inputMessages} />
            </TabPane>
          ) : null}
          {hasLLMToolSchemas ? (
            <TabPane name="Tools" hidden={!hasLLMToolSchemas}>
              <LLMToolSchemasList toolSchemas={llmToolSchemas} />
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
  const retrieverAttributes = useMemo<AttributeRetrieval | null>(
    () => spanAttributes[SemanticAttributePrefixes.retrieval] || null,
    [spanAttributes]
  );
  const documents = useMemo<AttributeDocument[]>(() => {
    if (retrieverAttributes == null) {
      return [];
    }
    return (retrieverAttributes[RetrievalAttributePostfixes.documents]
      ?.map((obj) => obj[SemanticAttributePrefixes.document])
      .filter(Boolean) || []) as AttributeDocument[];
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
        <MarkdownDisplayProvider>
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
  const rerankerAttributes = useMemo<AttributeReranker | null>(
    () => spanAttributes[SemanticAttributePrefixes.reranker] || null,
    [spanAttributes]
  );
  const query = useMemo<string | null>(() => {
    if (rerankerAttributes == null) {
      return null;
    }
    return rerankerAttributes[RerankerAttributePostfixes.query] || null;
  }, [rerankerAttributes]);
  const input_documents = useMemo<AttributeDocument[]>(() => {
    if (rerankerAttributes == null) {
      return [];
    }
    return (rerankerAttributes[RerankerAttributePostfixes.input_documents]
      ?.map((obj) => obj[SemanticAttributePrefixes.document])
      .filter(Boolean) || []) as AttributeDocument[];
  }, [rerankerAttributes]);
  const output_documents = useMemo<AttributeDocument[]>(() => {
    if (rerankerAttributes == null) {
      return [];
    }
    return (rerankerAttributes[RerankerAttributePostfixes.output_documents]
      ?.map((obj) => obj[SemanticAttributePrefixes.document])
      .filter(Boolean) || []) as AttributeDocument[];
  }, [rerankerAttributes]);

  const numInputDocuments = input_documents.length;
  const numOutputDocuments = output_documents.length;
  return (
    <Flex direction="column" gap="size-200">
      <MarkdownDisplayProvider>
        {query && (
          <Card title="Query" {...defaultCardProps}>
            <ConnectedMarkdownBlock>{query}</ConnectedMarkdownBlock>
          </Card>
        )}
      </MarkdownDisplayProvider>
      <Card
        title={"Input Documents"}
        titleExtra={<Counter variant="light">{numInputDocuments}</Counter>}
        {...defaultCardProps}
        defaultOpen={false}
        bodyStyle={{ padding: 0 }}
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
        bodyStyle={{ padding: 0 }}
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
  const embeddingAttributes = useMemo<AttributeEmbedding | null>(
    () => spanAttributes[SemanticAttributePrefixes.embedding] || null,
    [spanAttributes]
  );
  const embeddings = useMemo<AttributeEmbeddingEmbedding[]>(() => {
    if (embeddingAttributes == null) {
      return [];
    }
    return (embeddingAttributes[EmbeddingAttributePostfixes.embeddings]
      ?.map((obj) => obj[SemanticAttributePrefixes.embedding])
      .filter(Boolean) || []) as AttributeEmbeddingEmbedding[];
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
                          {embedding[EmbeddingAttributePostfixes.text] || ""}
                        </ConnectedMarkdownBlock>
                      </Card>
                    </MarkdownDisplayProvider>
                  </li>
                );
              })}
            </ul>
          }
        </Card>
      ) : (
        <SpanIO span={props.span} />
      )}
    </Flex>
  );
}

function ToolSpanInfo(props: { span: Span; spanAttributes: AttributeObject }) {
  const { span, spanAttributes } = props;
  const { input, output } = span;
  const hasInput = typeof input?.value === "string";
  const hasOutput = typeof output?.value === "string";
  const inputIsText = input?.mimeType === "text";
  const outputIsText = output?.mimeType === "text";
  const toolAttributes = useMemo<AttributeTool>(
    () => spanAttributes[SemanticAttributePrefixes.tool] || {},
    [spanAttributes]
  );
  const hasToolAttributes = Object.keys(toolAttributes).length > 0;
  const toolName = toolAttributes[ToolAttributePostfixes.name];
  const toolDescription = toolAttributes[ToolAttributePostfixes.description];
  const toolParameters = toolAttributes[ToolAttributePostfixes.parameters];
  if (!hasInput && !hasOutput && !hasToolAttributes) {
    return null;
  }
  return (
    <Flex direction="column" gap="size-200">
      {hasInput ? (
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
      {hasOutput ? (
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
      {hasToolAttributes ? (
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
      ) : null}
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
  const metadata = document[DocumentAttributePostfixes.metadata];
  const hasEvaluations = documentEvaluations && documentEvaluations.length;
  const documentContent = document[DocumentAttributePostfixes.content];
  return (
    <Card
      {...defaultCardProps}
      backgroundColor={backgroundColor}
      borderColor={borderColor}
      bodyStyle={{
        padding: 0,
      }}
      title={
        <Flex direction="row" gap="size-50" alignItems="center">
          <Icon svg={<Icons.FileOutline />} />
          <Heading level={4}>
            document {document[DocumentAttributePostfixes.id]}
          </Heading>
        </Flex>
      }
      extra={
        typeof document[DocumentAttributePostfixes.score] === "number" && (
          <Label color={labelColor}>{`score ${numberFormatter(
            document[DocumentAttributePostfixes.score]
          )}`}</Label>
        )
      }
    >
      <Flex direction="column">
        {documentContent && (
          <View padding="size-200">
            <ConnectedMarkdownBlock>{documentContent}</ConnectedMarkdownBlock>
          </View>
        )}
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
  const messageContent = message[MessageAttributePostfixes.content];
  // as of multi-modal models, a message can also be a list
  const messagesContents = message[MessageAttributePostfixes.contents];
  const toolCalls =
    message[MessageAttributePostfixes.tool_calls]
      ?.map((obj) => obj[SemanticAttributePrefixes.tool_call])
      .filter(Boolean) || [];
  const hasFunctionCall =
    message[MessageAttributePostfixes.function_call_arguments_json] &&
    message[MessageAttributePostfixes.function_call_name];
  const role = message[MessageAttributePostfixes.role] || "unknown";
  const messageStyles = useChatMessageStyles(role);

  return (
    <MarkdownDisplayProvider>
      <Card
        {...defaultCardProps}
        {...messageStyles}
        title={
          role +
          (message[MessageAttributePostfixes.name]
            ? `: ${message[MessageAttributePostfixes.name]}`
            : "")
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
        <ErrorBoundary>
          {messagesContents ? (
            <MessageContentsList messageContents={messagesContents} />
          ) : null}
        </ErrorBoundary>
        <Flex direction="column" alignItems="start">
          {messageContent ? (
            <ConnectedMarkdownBlock>{messageContent}</ConnectedMarkdownBlock>
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
                    {toolCall?.function?.name as string}(
                    {JSON.stringify(
                      JSON.parse(toolCall?.function?.arguments as string),
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
              {message[MessageAttributePostfixes.function_call_name] as string}(
              {JSON.stringify(
                JSON.parse(
                  message[
                    MessageAttributePostfixes.function_call_arguments_json
                  ] as string
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

function LLMToolSchema({
  toolSchema,
  index,
}: {
  toolSchema: string;
  index: number;
}) {
  const titleEl = (
    <Flex direction="row" gap="size-100" alignItems="center">
      <SpanKindIcon spanKind="tool" />
      <Text textSize="large" weight="heavy">
        Tool
      </Text>
    </Flex>
  );

  return (
    <Card
      title={titleEl}
      titleExtra={<Counter variant="light">#{index + 1}</Counter>}
      {...defaultCardProps}
      backgroundColor="yellow-100"
      borderColor="yellow-700"
      bodyStyle={{ padding: 0 }}
      extra={<CopyToClipboardButton text={toolSchema} />}
    >
      <CodeBlock value={toolSchema} mimeType={"json"} />
    </Card>
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

function LLMToolSchemasList({ toolSchemas }: { toolSchemas: string[] }) {
  return (
    <ul
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--ac-global-dimension-static-size-100);
        padding: var(--ac-global-dimension-static-size-200);
      `}
    >
      {toolSchemas.map((toolSchema, idx) => {
        return (
          <li key={idx}>
            <LLMToolSchema toolSchema={toolSchema} index={idx} />
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

const messageContentListCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--ac-global-dimension-size-200);
  flex-wrap: wrap;
`;

/**
 * A list of message contents. Used for multi-modal models.
 */
function MessageContentsList({
  messageContents,
}: {
  messageContents: AttributeMessageContent[];
}) {
  return (
    <ul css={messageContentListCSS} data-testid="message-content-list">
      {messageContents.map((messageContent, idx) => {
        return (
          <MessageContentListItem
            key={idx}
            messageContentAttribute={messageContent}
          />
        );
      })}
    </ul>
  );
}

/**
 * Display text content in full width.
 */
const messageContentTextListItemCSS = css`
  flex: 1 1 100%;
`;
/**
 * Displays multi-modal message content. Typically an image or text.
 * Examples:
 * {"message_content":{"text":"What is in this image?","type":"text"}}
 * {"message_content":{"type":"image","image":{"image":{"url":"https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"}}}}
 */
function MessageContentListItem({
  messageContentAttribute,
}: {
  messageContentAttribute: AttributeMessageContent;
}) {
  const { message_content } = messageContentAttribute;
  const text = message_content?.text;
  const image = message_content?.image;
  const imageUrl = image?.image?.url;

  return (
    <li css={text ? messageContentTextListItemCSS : null}>
      {text ? (
        <pre
          css={css`
            white-space: pre-wrap;
            padding: 0;
            margin: 0;
          `}
        >
          {text}
        </pre>
      ) : null}
      {imageUrl ? <SpanImage url={imageUrl} /> : null}
    </li>
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
          bodyStyle={{ padding: 0 }}
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
        value={value}
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

const attributesContextualHelp = (
  <Flex alignItems="center" justifyContent="center">
    <View marginStart="size-100">
      <ContextualHelp>
        <Heading weight="heavy" level={4}>
          Span Attributes
        </Heading>
        <Content>
          <Text>
            Attributes are key-value pairs that represent metadata associated
            with a span. For detailed descriptions of specific attributes,
            consult the semantic conventions section of the OpenInference
            tracing specification.
          </Text>
        </Content>
        <footer>
          <ExternalLink href="https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md">
            Semantic Conventions
          </ExternalLink>
        </footer>
      </ContextualHelp>
    </View>
  </Flex>
);
