import {
  EmbeddingAttributePostfixes,
  LLMAttributePostfixes,
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
} from "@phoenix/openInference/tracing/types";
import { isAttributeMessages } from "@phoenix/openInference/tracing/types";
import { isStringArray } from "@phoenix/typeUtils";
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
  const toolSchemas = toolDefinitions.reduce((acc, tool) => {
    if (tool?.json_schema) {
      acc.push(tool.json_schema);
    }
    return acc;
  }, [] as string[]);

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
 * Extract the tool description from the parsed span attributes of a tool span.
 */
export function getToolAttributes(
  spanAttributes: AttributeObject
): ToolSpanAttributes {
  const toolAttributes = spanAttributes[SemanticAttributePrefixes.tool] || {};
  return {
    hasToolAttributes: Object.keys(toolAttributes).length > 0,
    name: toolAttributes[ToolAttributePostfixes.name],
    description: toolAttributes[ToolAttributePostfixes.description],
    parameters: toolAttributes[ToolAttributePostfixes.parameters],
  };
}

/**
 * Group document evaluations by the position of the document they annotate.
 */
export function groupDocumentEvaluationsByPosition(
  documentEvaluations: ReadonlyArray<DocumentEvaluation>
): Partial<Record<number, DocumentEvaluation[]>> {
  return documentEvaluations.reduce(
    (acc, documentEvaluation) => {
      const documentPosition = documentEvaluation.documentPosition;
      const evaluations = acc[documentPosition] || [];
      return {
        ...acc,
        [documentPosition]: [...evaluations, documentEvaluation],
      };
    },
    {} as Partial<Record<number, DocumentEvaluation[]>>
  );
}
