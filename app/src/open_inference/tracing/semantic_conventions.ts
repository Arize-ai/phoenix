export const SemanticAttributePrefixes = {
  llm: "llm",
  retrieval: "retrieval",
} as const;

export const LLMAttributePostfixes = {
  messages: "messages",
  invocation_parameters: "invocation_parameters",
} as const;

function createAttribute(
  prefix: keyof typeof SemanticAttributePrefixes,
  name: string
) {
  return `${prefix}.${name}`;
}

/**
 * The message generations coming out of an LLM
 */
export const LLM_MESSAGES = createAttribute(
  SemanticAttributePrefixes.llm,
  LLMAttributePostfixes.messages
);
