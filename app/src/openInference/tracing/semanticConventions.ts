export const SemanticAttributePrefixes = {
  llm: "llm",
  retrieval: "retrieval",
  messages: "messages",
  message: "message",
  document: "document",
  embedding: "embedding",
} as const;

export const LLMAttributePostfixes = {
  messages: "messages",
  invocation_parameters: "invocation_parameters",
  prompts: "prompts",
} as const;

export const RetrievalAttributePostfixes = {
  documents: "documents",
} as const;

export const EmbeddingAttributePostfixes = {
  embeddings: "embeddings",
  text: "text",
  model_name: "model_name",
} as const;

export const MessageAttributePostfixes = {
  role: "role",
  content: "content",
  name: "name",
  function_call_name: "function_call_name",
  function_call_arguments_json: "function_call_arguments_json",
} as const;

export const DocumentAttributePostfixes = {
  id: "id",
  content: "content",
  score: "score",
  metadata: "metadata",
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
 * The LLM function call function name
 */
export const MESSAGE_FUNCTION_CALL_NAME =
  `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.function_call_name}` as const;

/**
 * The LLM function call function arguments in a json string
 */
export const MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON =
  `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.function_call_arguments_json}` as const;
/**
 * The content of the message sent to the LLM
 */
export const MESSAGE_CONTENT =
  `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.content}` as const;

export const DOCUMENT_ID =
  `${SemanticAttributePrefixes.document}.${DocumentAttributePostfixes.id}` as const;

export const DOCUMENT_CONTENT =
  `${SemanticAttributePrefixes.document}.${DocumentAttributePostfixes.content}` as const;

export const DOCUMENT_SCORE =
  `${SemanticAttributePrefixes.document}.${DocumentAttributePostfixes.score}` as const;

export const DOCUMENT_METADATA =
  `${SemanticAttributePrefixes.document}.${DocumentAttributePostfixes.metadata}` as const;

/**
 * The text that was embedded to create the vector
 */
export const EMBEDDING_TEXT =
  `${SemanticAttributePrefixes.embedding}.${EmbeddingAttributePostfixes.text}` as const;

/**
 * The name of the model that was used to create the vector
 */
export const EMBEDDING_MODEL_NAME =
  `${SemanticAttributePrefixes.embedding}.${EmbeddingAttributePostfixes.model_name}` as const;
