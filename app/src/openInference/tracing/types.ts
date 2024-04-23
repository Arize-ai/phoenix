import {
  EmbeddingAttributePostfixes,
  LLMAttributePostfixes,
  LLMPromptTemplateAttributePostfixes,
  MessageAttributePostfixes,
  RerankerAttributePostfixes,
  RetrievalAttributePostfixes,
  ToolAttributePostfixes,
} from "@arizeai/openinference-semantic-conventions";
import {
  DocumentAttributePostfixes,
  SemanticAttributePrefixes,
} from "@arizeai/openinference-semantic-conventions/src/trace/SemanticConventions";

export type AttributeTool = {
  [ToolAttributePostfixes.name]?: string;
  [ToolAttributePostfixes.description]?: string;
  [ToolAttributePostfixes.parameters]?: string;
};
export type AttributeToolCall = {
  function?: {
    name?: string;
    arguments?: string;
  };
};

export type AttributeMessages = {
  [SemanticAttributePrefixes.message]?: AttributeMessage;
}[];
export type AttributeMessage = {
  [MessageAttributePostfixes.role]?: string;
  [MessageAttributePostfixes.content]?: string;
  [MessageAttributePostfixes.name]?: string;
  [MessageAttributePostfixes.function_call_name]?: string;
  [MessageAttributePostfixes.function_call_arguments_json]?: string;
  [MessageAttributePostfixes.tool_calls]?: {
    [SemanticAttributePrefixes.tool_call]?: AttributeToolCall;
  }[];
};

export type AttributeRetrieval = {
  [RetrievalAttributePostfixes.documents]?: {
    [SemanticAttributePrefixes.document]?: AttributeDocument;
  }[];
};
export type AttributeDocument = {
  [DocumentAttributePostfixes.id]?: string;
  [DocumentAttributePostfixes.content]?: string;
  [DocumentAttributePostfixes.score]?: number;
  [DocumentAttributePostfixes.metadata]?: string;
};

export type AttributeEmbedding = {
  [EmbeddingAttributePostfixes.model_name]?: string;
  [EmbeddingAttributePostfixes.embeddings]?: {
    [SemanticAttributePrefixes.embedding]?: AttributeEmbeddingEmbedding;
  }[];
};
export type AttributeEmbeddingEmbedding = {
  [EmbeddingAttributePostfixes.text]?: string;
};

export type AttributeReranker = {
  [RerankerAttributePostfixes.query]?: string;
  [RerankerAttributePostfixes.input_documents]?: {
    [SemanticAttributePrefixes.document]?: AttributeDocument;
  }[];
  [RerankerAttributePostfixes.output_documents]?: {
    [SemanticAttributePrefixes.document]?: AttributeDocument;
  }[];
};

export type AttributeLlm = {
  [LLMAttributePostfixes.model_name]?: string;
  [LLMAttributePostfixes.token_count]?: number;
  [LLMAttributePostfixes.input_messages]?: AttributeMessages;
  [LLMAttributePostfixes.output_messages]?: AttributeMessages;
  [LLMAttributePostfixes.invocation_parameters]?: string;
  [LLMAttributePostfixes.prompts]?: string[];
  [LLMAttributePostfixes.prompt_template]?: AttributePromptTemplate;
};

export type AttributePromptTemplate = {
  [LLMPromptTemplateAttributePostfixes.template]: string;
  [LLMPromptTemplateAttributePostfixes.variables]: Record<string, string>;
};
