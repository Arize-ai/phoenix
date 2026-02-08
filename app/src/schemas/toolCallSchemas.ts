import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { ToolCallPart } from "@phoenix/schemas/promptSchemas";
import { assertUnreachable } from "@phoenix/typeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { JSONLiteral, jsonLiteralSchema } from "./jsonLiteralSchema";

/**
 * The schema for an OpenAI tool call, this is what a message that calls a tool looks like
 *
 * Note: The nested passThrough's are used to allow for extra keys in JSON schema, however, they do not actually
 * allow for extra keys when the zod schema is used for parsing. This is to allow more flexibility for users
 * to define their own tool calls according
 */
export const openAIToolCallSchema = z.object({
  id: z.string().describe("The ID of the tool call"),
  type: z
    .literal("function")
    .describe("The type of the tool call")
    .default("function"),
  function: z
    .object({
      name: z.string().describe("The name of the function"),
      // TODO(Parker): The arguments here should not actually be a string, however this is a relic from the current way we stream tool calls where the chunks will come in as strings of partial json objects fix this here: https://github.com/Arize-ai/phoenix/issues/5269
      arguments: z
        // TODO(apowell): This is dishonest. OpenAI and our backend expects a string, but we stringify it behind the scenes.
        .record(z.unknown())
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
 *     arguments: { "city": "San Francisco" }
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

export const awsToolCallSchema = z.object({
  toolUse: z.object({
    toolUseId: z.string().describe("The ID of the tool call"),
    name: z.string().describe("The name of the tool"),
    input: z.record(z.unknown()).describe("The input for the tool"),
  }),
});

export type AwsToolCall = z.infer<typeof awsToolCallSchema>;

export const awsToolCallsSchema = z.array(awsToolCallSchema);

export const awsToolCallsJSONSchema = zodToJsonSchema(awsToolCallsSchema, {
  removeAdditionalStrategy: "passthrough",
});

export const openAIToolCallToAws = openAIToolCallSchema.transform(
  (openai): AwsToolCall => ({
    toolUse: {
      toolUseId: openai.id,
      name: openai.function.name,
      input: openai.function.arguments,
    },
  })
);

export const awsToolCallToOpenAI = awsToolCallSchema.transform(
  (aws): OpenAIToolCall => ({
    id: aws.toolUse.toolUseId,
    type: "function",
    function: {
      name: aws.toolUse.name,
      arguments: aws.toolUse.input,
    },
  })
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
export const anthropicToolCallToOpenAI = anthropicToolCallSchema.transform(
  (anthropic): OpenAIToolCall => ({
    id: anthropic.id,
    type: "function",
    function: {
      name: anthropic.name,
      arguments: anthropic.input,
    },
  })
);

/**
 * Parse incoming object as an OpenAI tool call and immediately convert to Anthropic format
 */
export const openAIToolCallToAnthropic = openAIToolCallSchema.transform(
  (openai): AnthropicToolCall => ({
    id: openai.id,
    type: "tool_use",
    name: openai.function.name,
    // TODO(parker): see comment in openai schema above, fix this here https://github.com/Arize-ai/phoenix/issues/5269
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
  awsToolCallSchema,
  jsonLiteralSchema,
]);

export type LlmProviderToolCall = z.infer<typeof llmProviderToolCallSchema>;

/**
 * A union of all the lists of tool call formats
 *
 * This is useful for parsing all of the tool calls in a message
 */
export const llmProviderToolCallsSchema = z.array(llmProviderToolCallSchema);

export type LlmProviderToolCalls = z.infer<typeof llmProviderToolCallsSchema>;

type ToolCallWithProvider =
  | {
      provider: Extract<ModelProvider, "OPENAI" | "AZURE_OPENAI">;
      validatedToolCall: OpenAIToolCall;
    }
  | {
      provider: Extract<ModelProvider, "ANTHROPIC">;
      validatedToolCall: AnthropicToolCall;
    }
  | {
      provider: Extract<ModelProvider, "AWS">;
      validatedToolCall: AwsToolCall;
    }
  | { provider: "UNKNOWN"; validatedToolCall: null };

/**
 * Detect the provider of a tool call object
 */
export const detectToolCallProvider = (
  toolCall: unknown
): ToolCallWithProvider => {
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

  const { success: awsSuccess, data: awsData } =
    awsToolCallSchema.safeParse(toolCall);
  if (awsSuccess) {
    return { provider: "AWS", validatedToolCall: awsData };
  }

  return { provider: "UNKNOWN", validatedToolCall: null };
};

type ProviderToToolCallMap = {
  OPENAI: OpenAIToolCall;
  AZURE_OPENAI: OpenAIToolCall;
  DEEPSEEK: OpenAIToolCall;
  XAI: OpenAIToolCall;
  PERPLEXITY: OpenAIToolCall;
  OLLAMA: OpenAIToolCall;
  AWS: AwsToolCall;
  ANTHROPIC: AnthropicToolCall;
  // Use generic JSON type for unknown tool formats / new providers
  GOOGLE: JSONLiteral;
};

/**
 * Converts a tool call to the OpenAI format if possible
 * @param toolCall a tool call from an unknown LlmProvider
 * @returns the tool call parsed to the OpenAI format
 */
export const toOpenAIToolCall = (
  maybeToolCall: unknown
): OpenAIToolCall | null => {
  const { provider, validatedToolCall } = detectToolCallProvider(maybeToolCall);
  switch (provider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      return validatedToolCall;
    case "ANTHROPIC":
      return anthropicToolCallToOpenAI.parse(validatedToolCall);
    case "AWS":
      return awsToolCallToOpenAI.parse(validatedToolCall);
    case "UNKNOWN":
      return null;
    default:
      assertUnreachable(provider);
  }
};

/**
 * Converts a tool call to a target provider format
 * @param toolCall the tool call to convert
 * @param targetProvider the provider to convert the tool call to
 * @returns the tool call in the target provider format
 */
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
    case "DEEPSEEK":
    case "XAI":
    case "PERPLEXITY":
    case "OLLAMA":
      return toolCall as ProviderToToolCallMap[T];
    case "AWS":
      return openAIToolCallToAws.parse(toolCall) as ProviderToToolCallMap[T];
    case "ANTHROPIC":
      return openAIToolCallToAnthropic.parse(
        toolCall
      ) as ProviderToToolCallMap[T];
    case "GOOGLE":
      return toolCall as ProviderToToolCallMap[T];
    default:
      assertUnreachable(targetProvider);
  }
};

export const fromPromptToolCallPart = (
  part: ToolCallPart,
  targetProvider: ModelProvider
) => {
  const toolCall = toOpenAIToolCall({
    id: part.toolCall.toolCallId,
    function: {
      name: part.toolCall.toolCall.name,
      arguments: safelyParseJSON(part.toolCall.toolCall.arguments).json || "",
    },
  });
  if (!toolCall) {
    return null;
  }
  return fromOpenAIToolCall({ toolCall, targetProvider });
};

/**
 * Creates an empty OpenAI tool call with fields but no values filled in
 */
export function createOpenAIToolCall(): OpenAIToolCall {
  return {
    id: "",
    type: "function",
    function: {
      name: "",
      arguments: {},
    },
  };
}

/**
 * Creates an empty Anthropic tool call with fields but no values filled in
 */
export function createAnthropicToolCall(): AnthropicToolCall {
  return {
    id: "",
    type: "tool_use",
    name: "",
    input: {},
  };
}

export function createAwsToolCall(): AwsToolCall {
  return {
    toolUse: {
      toolUseId: "",
      name: "",
      input: {},
    },
  };
}

/**
 * A schema for a tool call that is not in the first class supported format
 *
 * This is used to heuristically find the id, name, and arguments of a tool call
 * based on common patterns in tool calls, allowing us to poke around in an unknown tool call
 * and extract the id, name, and arguments
 */
export const toolCallHeuristicSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  arguments: z.record(z.unknown()).optional(),
  function: z
    .object({
      name: z.string().optional(),
      arguments: z.record(z.unknown()).optional(),
    })
    .optional(),
});

export function findToolCallId(maybeToolCall: unknown): string | null {
  let subject = maybeToolCall;
  if (typeof maybeToolCall === "string") {
    const parsed = safelyParseJSON(maybeToolCall);
    subject = parsed.json;
  }
  const toolCall = toOpenAIToolCall(subject);

  if (toolCall) {
    return toolCall.id;
  }

  // we don't have first class support for the incoming tool call
  // try some heuristics to find the id
  const heuristic = toolCallHeuristicSchema.safeParse(subject);
  if (heuristic.success) {
    return heuristic.data.id ?? heuristic.data.name ?? null;
  }

  return null;
}

export function findToolCallName(maybeToolCall: unknown): string | null {
  let subject = maybeToolCall;
  if (typeof maybeToolCall === "string") {
    const parsed = safelyParseJSON(maybeToolCall);
    subject = parsed.json;
  }

  const toolCall = toOpenAIToolCall(subject);

  if (toolCall) {
    return toolCall.function.name;
  }

  // we don't have first class support for the incoming tool call
  // try some heuristics to find the name
  const heuristic = toolCallHeuristicSchema.safeParse(subject);
  if (heuristic.success) {
    return (
      heuristic.data.function?.name ??
      heuristic.data.name ??
      // fallback to id if we don't have a name
      heuristic.data.id ??
      null
    );
  }

  return null;
}

export function findToolCallArguments(
  maybeToolCall: unknown
): JSONLiteral | null {
  let subject = maybeToolCall;
  if (typeof maybeToolCall === "string") {
    const parsed = safelyParseJSON(maybeToolCall);
    subject = parsed.json;
  }
  const toolCall = toOpenAIToolCall(subject);
  if (toolCall) {
    return toolCall.function.arguments as JSONLiteral;
  }

  // we don't have first class support for the incoming tool call
  // try some heuristics to find the arguments
  const heuristic = toolCallHeuristicSchema.safeParse(subject);
  if (heuristic.success) {
    return (
      ((heuristic.data.arguments ??
        heuristic.data.function?.arguments) as JSONLiteral) ?? null
    );
  }

  return null;
}
