import {
  DocumentAttributePostfixes,
  EmbeddingAttributePostfixes,
  LLMAttributePostfixes,
  MessageAttributePostfixes,
  MessageContentsAttributePostfixes,
  RerankerAttributePostfixes,
  RetrievalAttributePostfixes,
  SemanticAttributePrefixes,
  ToolAttributePostfixes,
} from "@arizeai/openinference-semantic-conventions";

import type {
  AttributeDocument,
  AttributeEmbeddingEmbedding,
  AttributeMessage,
  AttributeMessageContent,
  AttributeToolCall,
} from "@phoenix/openInference/tracing/types";
import { isStringArray } from "@phoenix/typeUtils";
import {
  formatContentAsString,
  isPlainObject,
  safelyParseJSON,
} from "@phoenix/utils/jsonUtils";

import type {
  AttributeObject,
  DocumentEvaluation,
  SpanAttributesParseResult,
  SpanPromptTemplate,
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
  promptTemplate: SpanPromptTemplate | null;
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
  const result = safelyParseJSON(attributes);
  if (result.parseError || isPlainObject(result.json)) {
    return result;
  }
  return {
    json: null,
    parseError: new Error("Span attributes must be a JSON object"),
  };
}

/**
 * Converts an untrusted semantic-convention leaf to display-safe text.
 */
function formatAttributeValue(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  return formatContentAsString(value, { unquotePlainString: true });
}

/**
 * Normalizes a tool call so no untrusted object can reach a text-only prop or
 * JSX child.
 */
function normalizeToolCall(value: unknown): AttributeToolCall | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const functionValue = value.function;
  const normalizedFunction = isPlainObject(functionValue)
    ? {
        name: formatAttributeValue(functionValue.name),
        arguments: formatAttributeValue(functionValue.arguments),
      }
    : undefined;
  return {
    id: formatAttributeValue(value.id),
    function: normalizedFunction,
  };
}

/**
 * Normalizes multi-modal message content into the subset rendered by the span
 * details panel.
 */
function normalizeMessageContent(
  value: unknown
): AttributeMessageContent | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const content = value[SemanticAttributePrefixes.message_content];
  if (!isPlainObject(content)) {
    return null;
  }
  const imageValue = content[MessageContentsAttributePostfixes.image];
  const nestedImage = isPlainObject(imageValue)
    ? imageValue[MessageContentsAttributePostfixes.image]
    : undefined;
  const image = isPlainObject(nestedImage)
    ? {
        [MessageContentsAttributePostfixes.image]: {
          url: formatAttributeValue(nestedImage.url),
        },
      }
    : undefined;
  return {
    [SemanticAttributePrefixes.message_content]: {
      [MessageContentsAttributePostfixes.type]: formatAttributeValue(
        content[MessageContentsAttributePostfixes.type]
      ),
      [MessageContentsAttributePostfixes.text]: formatAttributeValue(
        content[MessageContentsAttributePostfixes.text]
      ),
      [MessageContentsAttributePostfixes.image]: image,
    },
  };
}

/**
 * Normalizes one message into strings and validated arrays before React sees
 * it. Span attributes are external telemetry and do not honor the TypeScript
 * declarations at runtime.
 */
function normalizeMessage(value: unknown): AttributeMessage | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const rawContents = value[MessageAttributePostfixes.contents];
  const contents = Array.isArray(rawContents)
    ? rawContents
        .map(normalizeMessageContent)
        .filter(
          (content): content is AttributeMessageContent => content != null
        )
    : undefined;
  const rawToolCalls = value[MessageAttributePostfixes.tool_calls];
  const toolCalls = Array.isArray(rawToolCalls)
    ? rawToolCalls
        .map((wrapper) =>
          isPlainObject(wrapper)
            ? normalizeToolCall(wrapper[SemanticAttributePrefixes.tool_call])
            : null
        )
        .filter((toolCall): toolCall is AttributeToolCall => toolCall != null)
        .map((toolCall) => ({
          [SemanticAttributePrefixes.tool_call]: toolCall,
        }))
    : undefined;
  return {
    [MessageAttributePostfixes.role]: formatAttributeValue(
      value[MessageAttributePostfixes.role]
    ),
    [MessageAttributePostfixes.content]: formatAttributeValue(
      value[MessageAttributePostfixes.content]
    ),
    [MessageAttributePostfixes.contents]: contents,
    [MessageAttributePostfixes.name]: formatAttributeValue(
      value[MessageAttributePostfixes.name]
    ),
    [MessageAttributePostfixes.function_call_name]: formatAttributeValue(
      value[MessageAttributePostfixes.function_call_name]
    ),
    [MessageAttributePostfixes.function_call_arguments_json]:
      formatAttributeValue(
        value[MessageAttributePostfixes.function_call_arguments_json]
      ),
    [MessageAttributePostfixes.tool_call_id]: formatAttributeValue(
      value[MessageAttributePostfixes.tool_call_id]
    ),
    [MessageAttributePostfixes.tool_calls]: toolCalls,
  };
}

/**
 * Extract the message objects from an untrusted messages attribute value.
 */
function getMessages(messagesValue: unknown): AttributeMessage[] {
  if (!Array.isArray(messagesValue)) {
    return [];
  }
  return messagesValue
    .map((wrapper) =>
      isPlainObject(wrapper)
        ? normalizeMessage(wrapper[SemanticAttributePrefixes.message])
        : null
    )
    .filter((message): message is AttributeMessage => message != null);
}

/**
 * Extract the tool call objects from a message's tool calls attribute.
 */
export function getToolCalls(message: AttributeMessage): AttributeToolCall[] {
  const toolCalls = message[MessageAttributePostfixes.tool_calls];
  if (!Array.isArray(toolCalls)) {
    return [];
  }
  return toolCalls
    .map((wrapper) =>
      isPlainObject(wrapper)
        ? normalizeToolCall(wrapper[SemanticAttributePrefixes.tool_call])
        : null
    )
    .filter((toolCall): toolCall is AttributeToolCall => toolCall != null);
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
  const llmAttributesValue = spanAttributes[SemanticAttributePrefixes.llm];
  if (!isPlainObject(llmAttributesValue)) {
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
  const llmAttributes = llmAttributesValue;

  const modelName =
    formatAttributeValue(llmAttributes[LLMAttributePostfixes.model_name]) ??
    null;
  const provider =
    formatAttributeValue(llmAttributes[LLMAttributePostfixes.provider]) ?? null;

  const tools = llmAttributes[LLMAttributePostfixes.tools];
  const toolDefinitions = Array.isArray(tools)
    ? tools
        .map((wrapper) =>
          isPlainObject(wrapper)
            ? wrapper[SemanticAttributePrefixes.tool]
            : undefined
        )
        .filter(isPlainObject)
    : [];
  const toolSchemas = toolDefinitions.reduce<string[]>((acc, tool) => {
    const schema = formatAttributeValue(
      tool[ToolAttributePostfixes.json_schema]
    );
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
    promptTemplate: getPromptTemplate(
      llmAttributes[LLMAttributePostfixes.prompt_template]
    ),
    invocationParameters:
      formatAttributeValue(
        llmAttributes[LLMAttributePostfixes.invocation_parameters]
      ) ?? "{}",
  };
}

function getPromptTemplate(value: unknown): SpanPromptTemplate | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const template = formatAttributeValue(value.template);
  const variables = value.variables;
  return template == null && variables == null ? null : { template, variables };
}

function normalizeDocument(value: unknown): AttributeDocument | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const score = value[DocumentAttributePostfixes.score];
  return {
    [DocumentAttributePostfixes.id]: formatAttributeValue(
      value[DocumentAttributePostfixes.id]
    ),
    [DocumentAttributePostfixes.content]: formatAttributeValue(
      value[DocumentAttributePostfixes.content]
    ),
    [DocumentAttributePostfixes.metadata]: formatAttributeValue(
      value[DocumentAttributePostfixes.metadata]
    ),
    [DocumentAttributePostfixes.score]:
      typeof score === "number" ? score : undefined,
  };
}

function getDocuments(value: unknown): AttributeDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((wrapper) =>
      isPlainObject(wrapper)
        ? normalizeDocument(wrapper[SemanticAttributePrefixes.document])
        : null
    )
    .filter((document): document is AttributeDocument => document != null);
}

/**
 * Extract the retrieved documents from the parsed span attributes of a
 * retriever span.
 */
export function getRetrieverAttributes(spanAttributes: AttributeObject): {
  documents: AttributeDocument[];
} {
  const retrieverAttributes =
    spanAttributes[SemanticAttributePrefixes.retrieval];
  if (!isPlainObject(retrieverAttributes)) {
    return { documents: [] };
  }
  return {
    documents: getDocuments(
      retrieverAttributes[RetrievalAttributePostfixes.documents]
    ),
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
  const rerankerAttributes = spanAttributes[SemanticAttributePrefixes.reranker];
  if (!isPlainObject(rerankerAttributes)) {
    return { query: null, inputDocuments: [], outputDocuments: [] };
  }
  return {
    query:
      formatAttributeValue(
        rerankerAttributes[RerankerAttributePostfixes.query]
      ) ?? null,
    inputDocuments: getDocuments(
      rerankerAttributes[RerankerAttributePostfixes.input_documents]
    ),
    outputDocuments: getDocuments(
      rerankerAttributes[RerankerAttributePostfixes.output_documents]
    ),
  };
}

/**
 * Extract the embeddings from the parsed span attributes of an embedding span.
 */
export function getEmbeddingAttributes(spanAttributes: AttributeObject): {
  embeddings: AttributeEmbeddingEmbedding[];
} {
  const embeddingAttributes =
    spanAttributes[SemanticAttributePrefixes.embedding];
  if (!isPlainObject(embeddingAttributes)) {
    return { embeddings: [] };
  }
  const embeddingsValue =
    embeddingAttributes[EmbeddingAttributePostfixes.embeddings];
  return {
    embeddings: Array.isArray(embeddingsValue)
      ? embeddingsValue.flatMap<AttributeEmbeddingEmbedding>((wrapper) => {
          const embedding = isPlainObject(wrapper)
            ? wrapper[SemanticAttributePrefixes.embedding]
            : undefined;
          if (!isPlainObject(embedding)) {
            return [];
          }
          return [
            {
              [EmbeddingAttributePostfixes.text]: formatAttributeValue(
                embedding[EmbeddingAttributePostfixes.text]
              ),
            },
          ];
        })
      : [],
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
 * Extract the tool description from the parsed span attributes of a tool span.
 */
export function getToolAttributes(
  spanAttributes: AttributeObject
): ToolSpanAttributes {
  const toolAttributesValue = spanAttributes[SemanticAttributePrefixes.tool];
  const toolAttributes = isPlainObject(toolAttributesValue)
    ? toolAttributesValue
    : {};
  return {
    hasToolAttributes: Object.keys(toolAttributes).length > 0,
    name: formatAttributeValue(toolAttributes[ToolAttributePostfixes.name]),
    description: formatAttributeValue(
      toolAttributes[ToolAttributePostfixes.description]
    ),
    parameters: formatAttributeValue(
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
  return JSON.stringify(value, null, 2) ?? String(value);
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
