import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { assertUnreachable } from "@phoenix/typeUtils";

/**
 * The schema for an OpenAI tool call, this is what a message that calls a tool looks like
 *
 * Note: The nested passThrough's are used to allow for extra keys in JSON schema, however, they do not actually
 * allow for extra keys when the zod schema is used for parsing. This is to allow more flexibility for users
 * to define their own tool calls according
 */
export const openAIToolCallSchema = z.object({
  id: z.string().describe("The ID of the tool call"),
  function: z
    .object({
      name: z.string().describe("The name of the function"),
      arguments: z
        .union([z.record(z.unknown()).optional(), z.string()])
        .describe("The arguments for the function"),
    })
    .describe("The function that is being called")
    .passthrough(),
});

/**
 * The type of an OpenAI tool call
 *
 * @example
 * ```typescript
 *  {
 *   id: "1",
 *   function: {
 *     name: "getCurrentWeather",
 *     arguments: "{ \"city\": \"San Francisco\" }"
 *   }
 * }
 * ```
 */
export type OpenAIToolCall = z.infer<typeof openAIToolCallSchema>;

/**
 * The zod schema for multiple OpenAI Tool Calls
 */
export const openAIToolCallsSchema = z.array(openAIToolCallSchema);

/**
 * The JSON schema for multiple OpenAI tool calls
 */
export const openAIToolCallsJSONSchema = zodToJsonSchema(
  openAIToolCallsSchema,
  {
    removeAdditionalStrategy: "passthrough",
  }
);

/**
 * The schema for an Anthropic tool call, this is what a message that calls a tool looks like
 */
export const anthropicToolCallSchema = z
  .object({
    id: z.string().describe("The ID of the tool call"),
    type: z.literal("tool_use"),
    name: z.string().describe("The name of the tool"),
    input: z.record(z.unknown()).describe("The input for the tool"),
  })
  .passthrough();

/**
 * The type of an Anthropic tool call
 */
export type AnthropicToolCall = z.infer<typeof anthropicToolCallSchema>;

/**
 * The zod schema for multiple Anthropic tool calls
 */
export const anthropicToolCallsSchema = z.array(anthropicToolCallSchema);

/**
 * The JSON schema for multiple Anthropic tool calls
 */
export const anthropicToolCallsJSONSchema = zodToJsonSchema(
  anthropicToolCallsSchema,
  {
    removeAdditionalStrategy: "passthrough",
  }
);

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
    id: anthropic.id,
    function: {
      name: anthropic.name,
      arguments: anthropic.input,
    },
  })
);

/**
 * Parse incoming object as an OpenAI tool call and immediately convert to Anthropic format
 */
export const openAIToAnthropic = openAIToolCallSchema.transform(
  (openai): AnthropicToolCall => ({
    id: openai.id,
    type: "tool_use",
    name: openai.function.name,
    // REVIEW: anthropic wants a record always, openai wants string, record, or undefined
    // whats the best way to handle this?
    input:
      typeof openai.function.arguments === "string"
        ? { [openai.function.arguments]: openai.function.arguments }
        : (openai.function.arguments ?? {}),
  })
);

/**
 * --------------------------------
 * Conversion Helpers
 * --------------------------------
 */

/**
 * Union of all tool call formats
 *
 * This is useful for functions that need to accept any tool call format
 */
export const llmProviderToolCallSchema = z.union([
  openAIToolCallSchema,
  anthropicToolCallSchema,
]);

export type LlmProviderToolCall = z.infer<typeof llmProviderToolCallSchema>;

type ToolCallWithProvider =
  | {
      provider: Extract<ModelProvider, "OPENAI" | "AZURE_OPENAI">;
      validatedToolCall: OpenAIToolCall;
    }
  | {
      provider: Extract<ModelProvider, "ANTHROPIC">;
      validatedToolCall: AnthropicToolCall;
    };

/**
 * Detect the provider of a tool call object
 */
export const detectProvider = (toolCall: unknown): ToolCallWithProvider => {
  const { success: openaiSuccess, data: openaiData } =
    openAIToolCallSchema.safeParse(toolCall);
  if (openaiSuccess) {
    // we cannot disambiguate between azure openai and openai here
    return { provider: "OPENAI", validatedToolCall: openaiData };
  }
  const { success: anthropicSuccess, data: anthropicData } =
    anthropicToolCallSchema.safeParse(toolCall);
  if (anthropicSuccess) {
    return { provider: "ANTHROPIC", validatedToolCall: anthropicData };
  }
  throw new Error("Unknown tool call format");
};

type ProviderToToolCallMap = {
  OPENAI: OpenAIToolCall;
  AZURE_OPENAI: OpenAIToolCall;
  ANTHROPIC: AnthropicToolCall;
};

export const toOpenAIToolCall = (
  toolCall: LlmProviderToolCall
): OpenAIToolCall => {
  const { provider, validatedToolCall } = detectProvider(toolCall);
  switch (provider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      return validatedToolCall;
    case "ANTHROPIC":
      return anthropicToOpenAI.parse(validatedToolCall);
    default:
      assertUnreachable(provider);
  }
};

export const fromOpenAIToolCall = <T extends ModelProvider>({
  toolCall,
  targetProvider,
}: {
  toolCall: OpenAIToolCall;
  targetProvider: T;
}): ProviderToToolCallMap[T] => {
  switch (targetProvider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      return toolCall as ProviderToToolCallMap[T];
    case "ANTHROPIC":
      return openAIToAnthropic.parse(toolCall) as ProviderToToolCallMap[T];
    default:
      assertUnreachable(targetProvider);
  }
};
