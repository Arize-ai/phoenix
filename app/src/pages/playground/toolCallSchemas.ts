import { z } from "zod";

import { assertUnreachable } from "@phoenix/typeUtils";

export const jsonSchema = z
  .object({
    type: z.string(),
    // content changes based on the type
    // see https://json-schema.org/understanding-json-schema/reference/type
  })
  .passthrough();

/**
 * --------------------------------
 * Provider Schemas
 * --------------------------------
 */

/**
 * OpenAI tool call format
 */
export const openAIToolCallSchema = z.object({
  id: z.string().nullish(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    description: z.string().nullish(),
    parameters: jsonSchema,
  }),
});

export type OpenAIToolCall = z.infer<typeof openAIToolCallSchema>;

/**
 * Anthropic tool call format
 */
export const anthropicToolCallSchema = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: jsonSchema,
});

export type AnthropicToolCall = z.infer<typeof anthropicToolCallSchema>;

/**
 * --------------------------------
 * Conversion Schemas
 * --------------------------------
 */

/**
 * Parse incoming object as an Anthropic tool call and immediately convert to OpenAI format
 */
export const anthropicToOpenAI = anthropicToolCallSchema.transform(
  (anthropic): OpenAIToolCall => ({
    id: null, // generate?
    type: "function",
    function: {
      name: anthropic.name,
      description: anthropic.description,
      parameters: anthropic.input_schema,
    },
  })
);

/**
 * Parse incoming object as an OpenAI tool call and immediately convert to Anthropic format
 */
export const openAIToAnthropic = openAIToolCallSchema.transform(
  (openai): AnthropicToolCall => ({
    name: openai.function.name,
    description: openai.function.description ?? openai.function.name,
    input_schema: openai.function.parameters,
  })
);

/**
 * --------------------------------
 * Conversion Helpers
 * --------------------------------
 */

// Helper type for provider identification
export const providerType = z.enum(["openai", "anthropic"]);
export type ProviderType = z.infer<typeof providerType>;

/**
 * Union of all tool call formats
 *
 * This is useful for functions that need to accept any tool call format
 */
export const anyToolCallSchema = z.union([
  openAIToolCallSchema,
  anthropicToolCallSchema,
]);

export type AnyToolCall = z.infer<typeof anyToolCallSchema>;

/**
 * Convert from any tool call format to OpenAI format
 */
export const toOpenAIFormat = (
  toolCall: AnyToolCall,
  provider: ProviderType
): OpenAIToolCall => {
  switch (provider) {
    case "openai":
      return toolCall as OpenAIToolCall;
    case "anthropic":
      return anthropicToOpenAI.parse(toolCall as AnthropicToolCall);
    default:
      assertUnreachable(provider);
  }
};

/**
 * Convert from OpenAI tool call format to any other format
 */
export const fromOpenAIFormat = (
  toolCall: OpenAIToolCall,
  targetProvider: ProviderType
): AnyToolCall => {
  switch (targetProvider) {
    case "openai":
      return toolCall;
    case "anthropic":
      return openAIToAnthropic.parse(toolCall);
    default:
      assertUnreachable(targetProvider);
  }
};

/**
 * Detect the provider of a tool call object
 */
export const detectProvider = (toolCall: unknown): ProviderType => {
  if (openAIToolCallSchema.safeParse(toolCall).success) {
    return "openai";
  }
  if (anthropicToolCallSchema.safeParse(toolCall).success) {
    return "anthropic";
  }
  throw new Error("Unknown tool call format");
};
