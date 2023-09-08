export const SemanticAttributePrefixes = {
  llm: "llm",
  retrieval: "retrieval",
  messages: "messages",
  message: "message",
} as const;

export const LLMAttributePostfixes = {
  messages: "messages",
  invocation_parameters: "invocation_parameters",
} as const;

export const MessageAttributePostfixes = {
  role: "role",
  content: "content",
} as const;

/**
 * The message generations coming out of an LLM
 */
export const LLM_MESSAGES =
  `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.messages}` as const;

/**
 * The role that the LLM assumes the message is from
 * during the LLM invocation
 */
export const MESSAGE_ROLE =
  `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.role}` as const;

export const MESSAGE_CONTENT =
  `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.content}` as const;
