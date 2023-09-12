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
  name: "name",
} as const;

/**
 * The messages sent to the LLM for completions
 * Typically seen in openAI chat completions
 * @see https://beta.openai.com/docs/api-reference/completions/create
 */
export const LLM_MESSAGES =
  `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.messages}` as const;

/**
 * The role that the LLM assumes the message is from
 * during the LLM invocation
 */
export const MESSAGE_ROLE =
  `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.role}` as const;

/**
 * The name of the message. This is only used for role 'function' where the name
 * of the function is captured in the name field and the parameters are captured in the
 * content.
 */
export const MESSAGE_NAME =
  `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.name}` as const;

/**
 * The content of the message sent to the LLM
 */
export const MESSAGE_CONTENT =
  `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.content}` as const;
