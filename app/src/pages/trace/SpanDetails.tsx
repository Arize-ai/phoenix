import {
  PropsWithChildren,
  ReactNode,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  type ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { useNavigate } from "react-router";
import { json } from "@codemirror/lang-json";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror, {
  BasicSetupOptions,
  EditorView,
} from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import {
  Card,
  CardProps,
  Content,
  ContextualHelp,
  DialogContainer,
  EmptyGraphic,
  List,
  ListItem,
  TabbedCard,
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

import {
  Alert,
  Button,
  CopyToClipboardButton,
  Counter,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  ErrorBoundary,
  ExternalLink,
  Flex,
  Heading,
  Icon,
  Icons,
  Keyboard,
  LazyTabPanel,
  LinkButton,
  Tab,
  TabList,
  Tabs,
  Text,
  ToggleButton,
  Token,
  TokenProps,
  View,
  ViewProps,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative";
import {
  ConnectedMarkdownBlock,
  ConnectedMarkdownModeRadioGroup,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { SpanKindIcon } from "@phoenix/components/trace";
import {
  useNotifySuccess,
  usePreferencesContext,
  useTheme,
} from "@phoenix/contexts";
import { useViewer } from "@phoenix/contexts/ViewerContext";
import { useDimensions } from "@phoenix/hooks";
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
import { isModelProvider } from "@phoenix/utils/generativeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";
import { formatFloat, numberFormatter } from "@phoenix/utils/numberFormatUtils";

import { RetrievalEvaluationLabel } from "../project/RetrievalEvaluationLabel";
import { SpanHeader } from "../SpanHeader";

import {
  MimeType,
  SpanDetailsQuery,
  SpanDetailsQuery$data,
} from "./__generated__/SpanDetailsQuery.graphql";
import { SpanActionMenu } from "./SpanActionMenu";
import { SpanAside } from "./SpanAside";
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
  bodyStyle: { padding: 0 },
};

const CONDENSED_VIEW_CONTAINER_WIDTH_THRESHOLD = 900;
const ASIDE_PANEL_DEFAULT_SIZE = 33;
const EDIT_ANNOTATION_HOTKEY = "e";

export function SpanDetails({
  spanNodeId,
}: {
  /**
   * The Global ID of the span
   */
  spanNodeId: string;
}) {
  const isAnnotatingSpans = usePreferencesContext(
    (state) => state.isAnnotatingSpans
  );
  const setIsAnnotatingSpans = usePreferencesContext(
    (state) => state.setIsAnnotatingSpans
  );

  const asidePanelRef = useRef<ImperativePanelHandle>(null);
  const spanDetailsContainerRef = useRef<HTMLDivElement>(null);
  const spanDetailsContainerDimensions = useDimensions(spanDetailsContainerRef);
  const isCondensedView = spanDetailsContainerDimensions?.width
    ? spanDetailsContainerDimensions.width <
      CONDENSED_VIEW_CONTAINER_WIDTH_THRESHOLD
    : true;
  const { viewer } = useViewer();
  const { span } = useLazyLoadQuery<SpanDetailsQuery>(
    graphql`
      query SpanDetailsQuery($id: ID!, $filterUserIds: [ID]) {
        span: node(id: $id) {
          __typename
          ... on Span {
            id
            spanId
            trace {
              id
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
            startTime
            endTime
            id
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
              id
              name
            }
            ...SpanHeader_span
            ...SpanFeedback_annotations
            ...SpanAside_span @arguments(filterUserIds: $filterUserIds)
          }
        }
      }
    `,
    {
      id: spanNodeId,
      filterUserIds: viewer ? [viewer.id] : [null],
    }
  );

  if (span.__typename !== "Span") {
    throw new Error(
      "Expected a span, but got a different type" + span.__typename
    );
  }

  useHotkeys(
    EDIT_ANNOTATION_HOTKEY,
    () => {
      if (!isAnnotatingSpans) {
        setIsAnnotatingSpans(true);
      }
    },
    { preventDefault: true }
  );

  const hasExceptions = useMemo<boolean>(() => {
    return spanHasException(span);
  }, [span]);

  return (
    <PanelGroup direction="horizontal" autoSaveId="span-details-layout">
      <Panel order={1}>
        <Flex
          direction="column"
          flex="1 1 auto"
          height="100%"
          ref={spanDetailsContainerRef}
        >
          <View
            paddingTop="size-100"
            paddingBottom="size-50"
            paddingStart="size-150"
            paddingEnd="size-200"
            flex="none"
          >
            <Flex
              direction="row"
              alignItems="center"
              data-testid="span-header-row"
            >
              <SpanHeader span={span} />
              <Flex
                flex="none"
                direction="row"
                alignItems="center"
                gap="size-100"
              >
                <LinkButton
                  variant={span.spanKind !== "llm" ? "default" : "primary"}
                  leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
                  isDisabled={span.spanKind !== "llm"}
                  to={`/playground/spans/${span.id}`}
                  size="S"
                  aria-label="Prompt Playground"
                >
                  {isCondensedView ? null : "Playground"}
                </LinkButton>
                <AddSpanToDatasetButton
                  span={span}
                  buttonText={isCondensedView ? null : "Add to Dataset"}
                />
                <ToggleButton
                  size="S"
                  isSelected={isAnnotatingSpans}
                  onPress={() => {
                    setIsAnnotatingSpans(!isAnnotatingSpans);
                    const asidePanel = asidePanelRef.current;
                    // expand the panel if it is not the minimum size already
                    if (asidePanel) {
                      const size = asidePanel.getSize();
                      if (size < ASIDE_PANEL_DEFAULT_SIZE) {
                        asidePanel.resize(ASIDE_PANEL_DEFAULT_SIZE);
                      }
                    }
                  }}
                  leadingVisual={<Icon svg={<Icons.EditOutline />} />}
                  trailingVisual={
                    !isCondensedView &&
                    !isAnnotatingSpans && (
                      <Keyboard>{EDIT_ANNOTATION_HOTKEY}</Keyboard>
                    )
                  }
                >
                  {isCondensedView ? null : "Annotate"}
                </ToggleButton>
                <SpanActionMenu
                  traceId={span.trace.traceId}
                  spanId={span.spanId}
                />
              </Flex>
            </Flex>
          </View>
          <Tabs>
            <TabList>
              <Tab id="info">Info</Tab>
              <Tab id="annotations">
                Annotations <Counter>{span.spanAnnotations.length}</Counter>
              </Tab>
              <Tab id="attributes">Attributes</Tab>
              <Tab id="events">
                Events{" "}
                <Counter variant={hasExceptions ? "danger" : "default"}>
                  {span.events.length}
                </Counter>
              </Tab>
            </TabList>
            <LazyTabPanel id="info">
              <Flex direction="row" height="100%">
                <SpanInfoWrap>
                  <ErrorBoundary>
                    <SpanInfo span={span} />
                  </ErrorBoundary>
                </SpanInfoWrap>
              </Flex>
            </LazyTabPanel>
            <LazyTabPanel id="annotations">
              <SpanFeedback span={span} />
            </LazyTabPanel>
            <LazyTabPanel id="attributes">
              <View
                padding="size-200"
                height="100%"
                maxHeight="100%"
                overflow="auto"
              >
                <Card
                  title="All Attributes"
                  {...defaultCardProps}
                  titleExtra={attributesContextualHelp}
                  extra={<CopyToClipboardButton text={span.attributes} />}
                >
                  <JSONBlock>{span.attributes}</JSONBlock>
                </Card>
              </View>
            </LazyTabPanel>

            <LazyTabPanel id="events">
              <SpanEventsList events={span.events} />
            </LazyTabPanel>
          </Tabs>
        </Flex>
      </Panel>
      {isAnnotatingSpans && <PanelResizeHandle css={compactResizeHandleCSS} />}
      {isAnnotatingSpans && (
        <Panel
          order={2}
          ref={asidePanelRef}
          defaultSize={ASIDE_PANEL_DEFAULT_SIZE}
          minSize={10}
          collapsible
          onCollapse={() => {
            setIsAnnotatingSpans(false);
          }}
        >
          <SpanAside span={span} />
        </Panel>
      )}
    </PanelGroup>
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

function AddSpanToDatasetButton({
  span,
  buttonText,
}: {
  span: Span;
  buttonText: string | null;
}) {
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
        size="S"
        leadingVisual={<Icon svg={<Icons.DatabaseOutline />} />}
        onPress={onAddSpanToDataset}
      >
        {buttonText}
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
  const provider = llmAttributes?.[LLMAttributePostfixes.provider];

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
    let icon = <SpanKindIcon spanKind="llm" />;
    const normalizedProvider = provider?.toUpperCase();
    // Show the provider if it exists
    if (
      typeof normalizedProvider === "string" &&
      isModelProvider(normalizedProvider)
    ) {
      icon = <GenerativeProviderIcon provider={normalizedProvider} />;
    }
    return (
      <Flex direction="row" gap="size-100" alignItems="center">
        {icon}
        <Text size="M" weight="heavy">
          {modelName}
        </Text>
      </Flex>
    );
  }, [modelName, provider]);
  const hasInput = input != null && input.value != null;
  const hasInputMessages = inputMessages.length > 0;
  const hasLLMToolSchemas = llmToolSchemas.length > 0;
  const hasOutput = output != null && output.value != null;
  const hasOutputMessages = outputMessages.length > 0;
  const hasPrompts = prompts.length > 0;
  const hasInvocationParams =
    Object.keys(safelyParseJSON(invocation_parameters_str).json || {}).length >
    0;
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
          <TabList>
            {hasInputMessages && <Tab id="input-messages">Input Messages</Tab>}
            {hasLLMToolSchemas && <Tab id="tools">Tools</Tab>}
            {hasInput && <Tab id="input">Input</Tab>}
            {hasPromptTemplateObject && (
              <Tab id="prompt-template">Prompt Template</Tab>
            )}
            {hasPrompts && <Tab id="prompts">Prompts</Tab>}
            {hasInvocationParams && (
              <Tab id="invocation-params">Invocation Params</Tab>
            )}
          </TabList>

          {hasInputMessages && (
            <LazyTabPanel id="input-messages">
              <LLMMessagesList messages={inputMessages} />
            </LazyTabPanel>
          )}

          {hasLLMToolSchemas && (
            <LazyTabPanel id="tools">
              <LLMToolSchemasList toolSchemas={llmToolSchemas} />
            </LazyTabPanel>
          )}

          {hasInput && (
            <LazyTabPanel id="input">
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
            </LazyTabPanel>
          )}

          {hasPromptTemplateObject && (
            <LazyTabPanel id="prompt-template">
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
            </LazyTabPanel>
          )}

          {hasPrompts && (
            <LazyTabPanel id="prompts">
              <LLMPromptsList prompts={prompts} />
            </LazyTabPanel>
          )}

          {hasInvocationParams && (
            <LazyTabPanel id="invocation-params">
              <CopyToClipboard
                text={invocation_parameters_str}
                padding="size-100"
              >
                <JSONBlock>{invocation_parameters_str}</JSONBlock>
              </CopyToClipboard>
            </LazyTabPanel>
          )}
        </Tabs>
      </Card>
      {hasOutput || hasOutputMessages ? (
        <TabbedCard {...defaultCardProps}>
          <Tabs>
            <TabList>
              {hasOutputMessages && (
                <Tab id="output-messages">Output Messages</Tab>
              )}
              {hasOutput && <Tab id="output">Output</Tab>}
            </TabList>

            {hasOutputMessages && (
              <LazyTabPanel id="output-messages">
                <LLMMessagesList messages={outputMessages} />
              </LazyTabPanel>
            )}
            {hasOutput && (
              <LazyTabPanel id="output">
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
              </LazyTabPanel>
            )}
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
  const isText = hasInput && input.mimeType === "text";
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
              <Flex direction="row" gap="size-100" alignItems="center">
                {isText ? (
                  <ConnectedMarkdownModeRadioGroup />
                ) : (
                  <CopyToClipboardButton text={input.value} />
                )}
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
                padding: var(--ac-global-dimension-static-size-200);
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
                      tokenColor="var(--ac-global-color-seafoam-1000)"
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
            <View padding="size-200">
              <ConnectedMarkdownBlock>{query}</ConnectedMarkdownBlock>
            </View>
          </Card>
        )}
      </MarkdownDisplayProvider>
      <Card
        title={"Input Documents"}
        titleExtra={<Counter>{numInputDocuments}</Counter>}
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
                    tokenColor="var(--ac-global-color-seafoam-1000)"
                  />
                </li>
              );
            })}
          </ul>
        }
      </Card>
      <Card
        title={"Output Documents"}
        titleExtra={<Counter>{numOutputDocuments}</Counter>}
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
                    tokenColor="var(--ac-global-color-celery-1000)"
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
                padding: var(--ac-global-dimension-static-size-200);
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
              <Flex direction="row" gap="size-100" alignItems="center">
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
              <Flex direction="row" gap="size-100" alignItems="center">
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
                  <div
                    css={css`
                      .cm-editor {
                        background-color: transparent !important;
                      }
                    `}
                  >
                    <JSONBlock
                      basicSetup={{ lineNumbers: false, foldGutter: false }}
                    >
                      {JSON.stringify(toolParameters) as string}
                    </JSONBlock>
                  </div>
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
  tokenColor,
}: {
  document: AttributeDocument;
  documentEvaluations?: DocumentEvaluation[] | null;
  backgroundColor: ViewProps["backgroundColor"];
  borderColor: ViewProps["borderColor"];
  tokenColor: TokenProps["color"];
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
          <Token color={tokenColor}>
            {`score ${numberFormatter(
              document[DocumentAttributePostfixes.score]
            )}`}
          </Token>
        )
      }
    >
      <Flex direction="column">
        {documentContent && (
          <ConnectedMarkdownBlock>{documentContent}</ConnectedMarkdownBlock>
        )}
        {metadata && (
          <>
            <View borderColor={borderColor} borderTopWidth="thin">
              <View
                paddingX="size-200"
                paddingY="size-100"
                borderColor={borderColor}
                borderBottomWidth="thin"
              >
                <Heading level={4}>Document Metadata</Heading>
              </View>
              <JSONBlock basicSetup={{ lineNumbers: false }}>
                {JSON.stringify(metadata)}
              </JSONBlock>
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
                  const evalTokenColor =
                    documentEvaluation.label &&
                    DANGER_DOCUMENT_EVALUATION_LABELS.includes(
                      documentEvaluation.label
                    )
                      ? "var(--ac-global-color-danger)"
                      : tokenColor;
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
                              <Token color={evalTokenColor}>
                                {documentEvaluation.label}
                              </Token>
                            )}
                            {typeof documentEvaluation.score === "number" && (
                              <Token color={evalTokenColor}>
                                <Flex direction="row" gap="size-50">
                                  <Text
                                    size="XS"
                                    weight="heavy"
                                    color="inherit"
                                  >
                                    score
                                  </Text>
                                  <Text size="XS">
                                    {formatFloat(documentEvaluation.score)}
                                  </Text>
                                </Flex>
                              </Token>
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
  const toolCalls = message[MessageAttributePostfixes.tool_calls]
    ?.map((obj) => obj[SemanticAttributePrefixes.tool_call])
    .filter(Boolean);
  const hasFunctionCall =
    message[MessageAttributePostfixes.function_call_arguments_json] &&
    message[MessageAttributePostfixes.function_call_name];
  const role = message[MessageAttributePostfixes.role] || "unknown";
  const messageStyles = useChatMessageStyles(role);
  const toolCallDisclosureIds = useMemo(() => {
    return toolCalls?.map((_, idx) => `tool-call-${idx}`) || [];
  }, [toolCalls]);
  const toolResultId = message[MessageAttributePostfixes.tool_call_id];

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
          <Flex direction="row" gap="size-100" alignItems="center">
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
          <DisclosureGroup
            css={css`
              width: 100%;
              // when any .ac-disclosure-trigger is hovered, show the child .copy-to-clipboard-button
              .ac-disclosure-trigger {
                width: 100%;
                .copy-to-clipboard-button {
                  visibility: hidden;
                }
              }
              .ac-disclosure-trigger:hover,
              .ac-disclosure-trigger:focus-within,
              .ac-disclosure-trigger:focus-visible {
                .copy-to-clipboard-button {
                  visibility: visible;
                }
              }
            `}
            defaultExpandedKeys={[
              "tool-content",
              ...toolCallDisclosureIds,
              "function-call",
            ]}
          >
            {/* when the message is a tool result, show the tool result in a disclosure */}
            {messageContent && role.toLowerCase() === "tool" ? (
              <Disclosure id="tool-content">
                <DisclosureTrigger
                  arrowPosition="start"
                  justifyContent="space-between"
                >
                  <Text>
                    Tool Result{toolResultId ? `: ${toolResultId}` : ""}
                  </Text>
                  {toolResultId ? (
                    <CopyToClipboardButton text={toolResultId} />
                  ) : null}
                </DisclosureTrigger>
                <DisclosurePanel>
                  <View width="100%">
                    <ConnectedMarkdownBlock>
                      {messageContent}
                    </ConnectedMarkdownBlock>
                  </View>
                </DisclosurePanel>
              </Disclosure>
            ) : // when the message is any other kind, just show the content without a disclosure
            messageContent ? (
              <View width="100%">
                <ConnectedMarkdownBlock>
                  {messageContent}
                </ConnectedMarkdownBlock>
              </View>
            ) : null}
            {(toolCalls?.length ?? 0) > 0
              ? toolCalls?.map((toolCall, idx) => {
                  if (!toolCall) {
                    return null;
                  }
                  const id = toolCall.id;
                  const parsedArguments = safelyParseJSON(
                    toolCall?.function?.arguments as string
                  );

                  return (
                    <Disclosure
                      key={idx}
                      id={toolCallDisclosureIds[idx]}
                      css={
                        idx === 0
                          ? css`
                              border-top: 1px solid
                                var(--ac-global-border-color-default);
                            `
                          : null
                      }
                    >
                      <DisclosureTrigger
                        arrowPosition="start"
                        justifyContent="space-between"
                      >
                        <span>Tool Call{id ? `: ${id}` : ""}</span>
                        {id ? <CopyToClipboardButton text={id} /> : null}
                      </DisclosureTrigger>
                      <DisclosurePanel>
                        <pre
                          key={idx}
                          css={css`
                            text-wrap: wrap;
                            margin: var(--ac-global-dimension-static-size-100) 0;
                            padding: var(--ac-global-dimension-static-size-200);
                          `}
                        >
                          {toolCall?.function?.name as string}(
                          {parsedArguments.json
                            ? JSON.stringify(parsedArguments.json, null, 2)
                            : `${toolCall?.function?.arguments}`}
                          )
                        </pre>
                      </DisclosurePanel>
                    </Disclosure>
                  );
                })
              : null}
            {/*functionCall is deprecated and is superseded by toolCalls, so we don't expect both to be present*/}
            {hasFunctionCall ? (
              <Disclosure id="function-call">
                <DisclosureTrigger>
                  <Text>Function Call</Text>
                </DisclosureTrigger>
                <DisclosurePanel>
                  <pre
                    css={css`
                      text-wrap: wrap;
                      margin: var(--ac-global-dimension-static-size-100) 0;
                    `}
                  >
                    {
                      message[
                        MessageAttributePostfixes.function_call_name
                      ] as string
                    }
                    (
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
                </DisclosurePanel>
              </Disclosure>
            ) : null}
          </DisclosureGroup>
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
      <Text weight="heavy">Tool</Text>
    </Flex>
  );

  return (
    <Card
      title={titleEl}
      titleExtra={<Counter>#{index + 1}</Counter>}
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
              backgroundColor="grey-100"
              borderColor="grey-500"
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
              <Flex direction="row" gap="size-100" alignItems="center">
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
              <Flex direction="row" gap="size-100" alignItems="center">
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
  width: 100%;
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
function JSONBlock({
  children,
  basicSetup = {},
}: {
  children: string;
  basicSetup?: BasicSetupOptions;
}) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? githubLight : githubDark;
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
          ...basicSetup,
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
      data-testid="pre-block"
      css={css`
        white-space: pre-wrap;
        padding: var(--ac-global-dimension-static-size-200);
        font-size: var(--ac-global-font-size-s);
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
                  css={css`
                    &[data-event-type="exception"] {
                      --px-event-icon-color: var(--ac-global-color-danger);
                    }
                    &[data-event-type="info"] {
                      --px-event-icon-color: var(--ac-global-color-info);
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
