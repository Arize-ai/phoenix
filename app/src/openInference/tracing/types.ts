import {
  DOCUMENT_CONTENT,
  DOCUMENT_ID,
  DOCUMENT_METADATA,
  DOCUMENT_SCORE,
  EMBEDDING_TEXT,
  LLMPromptTemplateAttributePostfixes,
  MESSAGE_CONTENT,
  MESSAGE_NAME,
  MESSAGE_ROLE,
  MESSAGE_TOOL_CALLS,
  TOOL_CALL_FUNCTION_ARGUMENTS_JSON,
  TOOL_CALL_FUNCTION_NAME,
} from "@arizeai/openinference-semantic-conventions";

export type AttributeToolCall = {
  [TOOL_CALL_FUNCTION_NAME]: string;
  [TOOL_CALL_FUNCTION_ARGUMENTS_JSON]: string;
};

export type AttributeMessage = {
  [MESSAGE_ROLE]: string;
  [MESSAGE_CONTENT]: string;
  [MESSAGE_NAME]?: string;
  [MESSAGE_TOOL_CALLS]?: AttributeToolCall[];
  [key: string]: unknown;
};

export type AttributeDocument = {
  [DOCUMENT_ID]?: string;
  [DOCUMENT_CONTENT]: string;
  [DOCUMENT_SCORE]?: number;
  [DOCUMENT_METADATA]?: string;
  [key: string]: unknown;
};

export type AttributeEmbedding = {
  [EMBEDDING_TEXT]?: string;
  [key: string]: unknown;
};

export type AttributePromptTemplate = {
  [LLMPromptTemplateAttributePostfixes.template]: string;
  [LLMPromptTemplateAttributePostfixes.variables]: Record<string, string>;
  [key: string]: unknown;
};
