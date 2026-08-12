import {
  EmbeddingAttributePostfixes,
  LLMAttributePostfixes,
  MessageAttributePostfixes,
  RerankerAttributePostfixes,
  RetrievalAttributePostfixes,
  SemanticAttributePrefixes,
  ToolAttributePostfixes,
} from "@arizeai/openinference-semantic-conventions";

import type {
  AttributeDocument,
  AttributeEmbeddingEmbedding,
  AttributeLLMToolDefinition,
  AttributeMessage,
  AttributePromptTemplate,
  AttributeToolCall,
} from "@phoenix/openInference/tracing/types";
import { isAttributeMessages } from "@phoenix/openInference/tracing/types";
import { isStringArray } from "@phoenix/typeUtils";
import {
  toContentPreview,
  toRecordPreview,
  toToolCallsPreview,
} from "@phoenix/utils/contentPreviewUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import type {
  AttributeObject,
  DocumentEvaluation,
  SpanAttributesParseResult,
} from "./types";

/**
 * The attributes of an LLM span extracted into the shapes the LLM span
 * components render.
 */
export type LLMSpanAttributes = {
  modelName: string | null;
  provider: string | null;
  inputMessages: AttributeMessage[];
  outputMessages: AttributeMessage[];
  /**
   * The JSON schemas of the tools available to the LLM
   */
  toolSchemas: string[];
  prompts: string[];
  promptTemplate: AttributePromptTemplate | null;
  /**
   * The invocation parameters as a JSON string
   */
  invocationParameters: string;
};

/**
 * Safely parse the span attributes JSON string.
 * The single entry point for converting the raw attributes payload into an
 * object — kind-specific shapes are then extracted via the getters below.
 */
export function parseSpanAttributes(
  attributes: string
): SpanAttributesParseResult {
  return safelyParseJSON(attributes);
}

/**
 * Extract the message objects from an untrusted messages attribute value.
 */
function getMessages(messagesValue: unknown): AttributeMessage[] {
  // At this point, we cannot trust the type of the messages value
  if (!isAttributeMessages(messagesValue)) {
    return [];
  }
  return (messagesValue
    .map((obj) => obj[SemanticAttributePrefixes.message])
    .filter(Boolean) || []) as AttributeMessage[];
}

/**
 * Extract the tool call objects from a message's tool calls attribute.
 */
export function getToolCalls(message: AttributeMessage): AttributeToolCall[] {
  return (message[MessageAttributePostfixes.tool_calls]
    ?.map((obj) => obj[SemanticAttributePrefixes.tool_call])
    .filter(Boolean) || []) as AttributeToolCall[];
}

/**
 * A one-line excerpt of a message, shown in the header of its card while that
 * card is collapsed. Follows the order the card renders in, so the preview is
 * of what the reader would see first on expanding it, and falls through to the
 * message's calls when it has no content of its own — an assistant turn that
 * only calls tools would otherwise preview as nothing at all.
 */
export function getMessagePreview(
  message: AttributeMessage
): string | undefined {
  const content = message[MessageAttributePostfixes.content];
  const contents = message[MessageAttributePostfixes.contents];
  const functionCallName =
    message[MessageAttributePostfixes.function_call_name];
  const functionCallArguments =
    message[MessageAttributePostfixes.function_call_arguments_json];

  // The message is duck-typed, so `contents` is whatever the instrumentation
  // emitted. This runs in the card's own render, above the error boundary that
  // guards the rendered contents, so it has to survive any shape.
  const contentsText = (Array.isArray(contents) ? contents : [])
    .map(
      (content) => content?.[SemanticAttributePrefixes.message_content]?.text
    )
    .filter((text) => typeof text === "string" && text !== "")
    .join(" ");

  // The card renders the deprecated function call only when it has both a name
  // and its arguments, so previewing on the name alone would advertise a card
  // body that turns out to be empty
  const functionCall =
    functionCallName && functionCallArguments
      ? [{ name: functionCallName, arguments: functionCallArguments }]
      : [];

  return (
    toContentPreview(contentsText) ??
    toContentPreview(content) ??
    toToolCallsPreview(
      getToolCalls(message).map((toolCall) => ({
        name: toolCall.function?.name,
        arguments: toolCall.function?.arguments,
      }))
    ) ??
    toToolCallsPreview(functionCall)
  );
}

/**
 * A one-line excerpt of a prompt template for its card's collapsed header. The
 * template itself first, since that is the disclosure the card opens on, and
 * the variables it interpolates when there is no template to show.
 */
export function getPromptTemplatePreview(
  promptTemplate: AttributePromptTemplate
): string | undefined {
  return (
    toContentPreview(promptTemplate.template) ??
    toRecordPreview(promptTemplate.variables)
  );
}

/**
 * Count the tool calls across a set of messages.
 */
export function countToolCalls(messages: AttributeMessage[]): number {
  return messages.reduce(
    (count, message) => count + getToolCalls(message).length,
    0
  );
}

/**
 * Extract the LLM-specific attribute shapes from the parsed span attributes.
 */
export function getLLMAttributes(
  spanAttributes: AttributeObject
): LLMSpanAttributes {
  const llmAttributes = spanAttributes[SemanticAttributePrefixes.llm] || null;
  if (llmAttributes == null) {
    return {
      modelName: null,
      provider: null,
      inputMessages: [],
      outputMessages: [],
      toolSchemas: [],
      prompts: [],
      promptTemplate: null,
      invocationParameters: "{}",
    };
  }

  const maybeModelName = llmAttributes[LLMAttributePostfixes.model_name];
  const modelName = typeof maybeModelName === "string" ? maybeModelName : null;

  const maybeProvider = llmAttributes[LLMAttributePostfixes.provider];
  const provider = typeof maybeProvider === "string" ? maybeProvider : null;

  const tools = llmAttributes[LLMAttributePostfixes.tools];
  const toolDefinitions = Array.isArray(tools)
    ? (tools
        .map((obj) => obj[SemanticAttributePrefixes.tool])
        .filter(Boolean) as AttributeLLMToolDefinition[])
    : [];
  const toolSchemas = toolDefinitions.reduce<string[]>((acc, tool) => {
    // Same object-rebuilt-by-ingestion case as tool.parameters below: an
    // instrumentation that flattens `tool.json_schema.*` into dotted keys makes
    // ingestion store json_schema as a nested object, so it is typed unknown.
    // asToolAttributeString narrows it and coerces any non-string value back to
    // JSON text before it reaches MimeTypeCodeBlock, which expects string[].
    const schema = asToolAttributeString(tool?.json_schema);
    if (schema != null) {
      acc.push(schema);
    }
    return acc;
  }, []);

  const maybePrompts = llmAttributes[LLMAttributePostfixes.prompts];
  const prompts = isStringArray(maybePrompts) ? maybePrompts : [];

  return {
    modelName,
    provider,
    inputMessages: getMessages(
      llmAttributes[LLMAttributePostfixes.input_messages]
    ),
    outputMessages: getMessages(
      llmAttributes[LLMAttributePostfixes.output_messages]
    ),
    toolSchemas,
    prompts,
    promptTemplate:
      llmAttributes[LLMAttributePostfixes.prompt_template] ?? null,
    invocationParameters: (llmAttributes[
      LLMAttributePostfixes.invocation_parameters
    ] || "{}") as string,
  };
}

/**
 * Extract the retrieved documents from the parsed span attributes of a
 * retriever span.
 */
export function getRetrieverAttributes(spanAttributes: AttributeObject): {
  documents: AttributeDocument[];
} {
  const retrieverAttributes =
    spanAttributes[SemanticAttributePrefixes.retrieval] || null;
  if (retrieverAttributes == null) {
    return { documents: [] };
  }
  return {
    documents: (retrieverAttributes[RetrievalAttributePostfixes.documents]
      ?.map((obj) => obj[SemanticAttributePrefixes.document])
      .filter(Boolean) || []) as AttributeDocument[],
  };
}

/**
 * Extract the query and document lists from the parsed span attributes of a
 * reranker span.
 */
export function getRerankerAttributes(spanAttributes: AttributeObject): {
  query: string | null;
  inputDocuments: AttributeDocument[];
  outputDocuments: AttributeDocument[];
} {
  const rerankerAttributes =
    spanAttributes[SemanticAttributePrefixes.reranker] || null;
  if (rerankerAttributes == null) {
    return { query: null, inputDocuments: [], outputDocuments: [] };
  }
  return {
    query: rerankerAttributes[RerankerAttributePostfixes.query] || null,
    inputDocuments: (rerankerAttributes[
      RerankerAttributePostfixes.input_documents
    ]
      ?.map((obj) => obj[SemanticAttributePrefixes.document])
      .filter(Boolean) || []) as AttributeDocument[],
    outputDocuments: (rerankerAttributes[
      RerankerAttributePostfixes.output_documents
    ]
      ?.map((obj) => obj[SemanticAttributePrefixes.document])
      .filter(Boolean) || []) as AttributeDocument[],
  };
}

/**
 * Extract the embeddings from the parsed span attributes of an embedding span.
 */
export function getEmbeddingAttributes(spanAttributes: AttributeObject): {
  embeddings: AttributeEmbeddingEmbedding[];
} {
  const embeddingAttributes =
    spanAttributes[SemanticAttributePrefixes.embedding] || null;
  if (embeddingAttributes == null) {
    return { embeddings: [] };
  }
  return {
    embeddings: (embeddingAttributes[EmbeddingAttributePostfixes.embeddings]
      ?.map((obj) => obj[SemanticAttributePrefixes.embedding])
      .filter(Boolean) || []) as AttributeEmbeddingEmbedding[],
  };
}

/**
 * The attributes describing the tool of a tool span.
 */
export type ToolSpanAttributes = {
  hasToolAttributes: boolean;
  name?: string;
  description?: string;
  parameters?: string;
};

/**
 * Tool attributes are conventionally single string values, but an
 * instrumentation that flattens e.g. `tool.parameters.*` into dotted keys makes
 * Phoenix ingestion rebuild them as a nested object. The span view assumes a
 * string (it re-parses `parameters` and renders the others as text), so coerce
 * any non-string value back to its JSON text here rather than letting an object
 * reach the renderer — where it throws `Objects are not valid as a React child`.
 */
function asToolAttributeString(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * Extract the tool description from the parsed span attributes of a tool span.
 */
export function getToolAttributes(
  spanAttributes: AttributeObject
): ToolSpanAttributes {
  const toolAttributes = spanAttributes[SemanticAttributePrefixes.tool] || {};
  return {
    hasToolAttributes: Object.keys(toolAttributes).length > 0,
    name: asToolAttributeString(toolAttributes[ToolAttributePostfixes.name]),
    description: asToolAttributeString(
      toolAttributes[ToolAttributePostfixes.description]
    ),
    parameters: asToolAttributeString(
      toolAttributes[ToolAttributePostfixes.parameters]
    ),
  };
}

/**
 * The clipboard text for structured content shown in a card — pretty printed,
 * so what is copied reads like what the card body renders rather than the
 * compacted form the attributes arrive in.
 */
export function formatJSONForCopy(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * A JSON document that arrived in string form (a tool schema, a tool span's
 * parameter schema), parsed so it can be nested inside copied JSON rather than
 * escaped into it. Falls back to the string when it does not parse.
 */
export function parseJSONDocument(value: string): unknown {
  return safelyParseJSON(value).json ?? value;
}

/**
 * The clipboard text for content that arrives as a list of JSON documents in
 * string form (an LLM span's tool schemas) — one JSON array of schemas rather
 * than an array of escaped strings.
 */
export function formatJSONStringsForCopy(values: string[]): string {
  return formatJSONForCopy(values.map(parseJSONDocument));
}

/**
 * The clipboard text for a list of plain text items (an LLM span's raw prompts,
 * an embedding span's embedded texts). Joined rather than JSON encoded: the
 * items are prose, and escaping them would leave the reader with something they
 * cannot paste anywhere. Each item's own card copies it verbatim.
 */
export function formatTextListForCopy(values: string[]): string {
  return values.join("\n\n");
}

/**
 * Group document evaluations by the position of the document they annotate.
 */
export function groupDocumentEvaluationsByPosition(
  documentEvaluations: ReadonlyArray<DocumentEvaluation>
): Partial<Record<number, DocumentEvaluation[]>> {
  return documentEvaluations.reduce<
    Partial<Record<number, DocumentEvaluation[]>>
  >((acc, documentEvaluation) => {
    const documentPosition = documentEvaluation.documentPosition;
    const evaluations = acc[documentPosition] || [];
    return {
      ...acc,
      [documentPosition]: [...evaluations, documentEvaluation],
    };
  }, {});
}
