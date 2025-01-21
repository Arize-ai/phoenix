import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { ModelProviders } from "@phoenix/constants/generativeConstants";
import { normalizeMessageContent } from "@phoenix/pages/playground/playgroundUtils";
import { assertUnreachable } from "@phoenix/typeUtils";

import { JSONLiteral, jsonLiteralSchema } from "./jsonLiteralSchema";
import {
  type TextPart,
  textPartSchema,
  type ToolCallPart,
  toolCallPartSchema,
  type ToolResultPart,
  toolResultPartSchema,
} from "./promptSchemas";
import {
  anthropicToolCallSchema,
  anthropicToolCallToOpenAI,
  openAIToolCallSchema,
  openAIToolCallToAnthropic,
} from "./toolCallSchemas";

type ModelProvider = keyof typeof ModelProviders;

/**
 * OpenAI Message Schemas
 */
export const openAIMessageRoleSchema = z.enum([
  "system",
  "user",
  "assistant",
  "developer",
  "tool",
  "function",
]);

export type OpenAIMessageRole = z.infer<typeof openAIMessageRoleSchema>;

export const openAIMessageSchema = z
  .object({
    role: openAIMessageRoleSchema,
    content: z.string().nullable(),
    name: z.string().optional(),
    tool_call_id: z.string().optional(),
    tool_calls: z.array(openAIToolCallSchema).optional(),
  })
  .passthrough();

export type OpenAIMessage = z.infer<typeof openAIMessageSchema>;

export const openAIMessagesSchema = z.array(openAIMessageSchema);

export const openAIMessagesJSONSchema = zodToJsonSchema(openAIMessagesSchema, {
  removeAdditionalStrategy: "passthrough",
});

/**
 * Anthropic Message Schemas
 */
export const anthropicMessageRoleSchema = z.enum(["user", "assistant", "tool"]);

export type AnthropicMessageRole = z.infer<typeof anthropicMessageRoleSchema>;

export const anthropicBlockSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  input: z.record(jsonLiteralSchema).optional(),
  source: z
    .object({
      type: z.string(),
      media_type: z.string().optional(),
      data: z.string().optional(),
    })
    .optional(),
});

export const anthropicMessageSchema = z
  .object({
    role: anthropicMessageRoleSchema,
    content: z.union([z.string(), z.array(anthropicBlockSchema)]),
    tool_calls: z.array(anthropicToolCallSchema).optional(),
    tool_call_id: z.string().optional(),
  })
  .passthrough();

export type AnthropicMessage = z.infer<typeof anthropicMessageSchema>;

export const anthropicMessagesSchema = z.array(anthropicMessageSchema);

export const anthropicMessagesJSONSchema = zodToJsonSchema(
  anthropicMessagesSchema,
  {
    removeAdditionalStrategy: "passthrough",
  }
);

/**
 * Prompt Message Schemas
 */
export const promptMessageRoleSchema = z.enum(["SYSTEM", "USER", "AI", "TOOL"]);

export type PromptMessageRole = z.infer<typeof promptMessageRoleSchema>;

export const promptImagePartSchema = z.object({
  image: z.object({
    url: z.string(),
  }),
});

export type PromptImagePart = z.infer<typeof promptImagePartSchema>;

export const promptContentPartSchema = z.discriminatedUnion("__typename", [
  textPartSchema.extend({ __typename: z.literal("TextContentPart") }),
  promptImagePartSchema.extend({ __typename: z.literal("ImageContentPart") }),
  toolCallPartSchema.extend({ __typename: z.literal("ToolCallContentPart") }),
  toolResultPartSchema.extend({
    __typename: z.literal("ToolResultContentPart"),
  }),
]);

export type PromptContentPart = z.infer<typeof promptContentPartSchema>;

export const promptMessageSchema = z
  .object({
    role: promptMessageRoleSchema,
    content: z.array(promptContentPartSchema),
  })
  .passthrough();

export type PromptMessage = z.infer<typeof promptMessageSchema>;

export const promptMessagesSchema = z.array(promptMessageSchema);

export const promptMessagesJSONSchema = zodToJsonSchema(promptMessagesSchema, {
  removeAdditionalStrategy: "passthrough",
});

/**
 * Conversion Functions
 *
 * These follow a hub-and-spoke model where OpenAI is the hub format.
 * All conversions between different formats go through OpenAI as an intermediate step.
 */

/**
 * Spoke → Hub: Convert an Anthropic message to OpenAI format
 */
export const anthropicMessageToOpenAI = anthropicMessageSchema.transform(
  (anthropic): OpenAIMessage => {
    const base: OpenAIMessage = {
      role: anthropic.role as OpenAIMessageRole,
      content: Array.isArray(anthropic.content)
        ? anthropic.content
            .filter((block) => block.type === "text" && block.text)
            .map((block) => block.text!)
            .join("\n")
        : anthropic.content,
    };

    if (anthropic.tool_calls) {
      return {
        ...base,
        tool_calls: anthropic.tool_calls.map((tc) =>
          anthropicToolCallToOpenAI.parse(tc)
        ),
      };
    }

    if (anthropic.tool_call_id) {
      return {
        ...base,
        tool_call_id: anthropic.tool_call_id,
      };
    }

    return base;
  }
);

/**
 * Hub → Spoke: Convert an OpenAI message to Anthropic format
 */
export const openAIMessageToAnthropic = openAIMessageSchema.transform(
  (openai): AnthropicMessage => {
    const base: AnthropicMessage = {
      role:
        openai.role === "system"
          ? "user"
          : (openai.role as AnthropicMessageRole),
      content: openai.content ? [{ type: "text", text: openai.content }] : [],
    };

    if (openai.tool_calls) {
      return {
        ...base,
        tool_calls: openai.tool_calls.map((tc) =>
          openAIToolCallToAnthropic.parse(tc)
        ),
      };
    }

    if (openai.tool_call_id) {
      return {
        ...base,
        tool_call_id: openai.tool_call_id,
      };
    }

    return base;
  }
);

/**
 * Spoke → Hub: Convert a Prompt message to OpenAI format
 */
export const promptMessageToOpenAI = promptMessageSchema.transform(
  (prompt): OpenAIMessage => {
    // Special handling for TOOL role messages
    if (prompt.role === "TOOL") {
      // A TOOL role message must have a tool result in its content
      const toolResult = prompt.content.find(
        (
          part
        ): part is ToolResultPart & { __typename: "ToolResultContentPart" } =>
          part.__typename === "ToolResultContentPart"
      );

      if (!toolResult) {
        throw new Error("TOOL role message must have a ToolResultContentPart");
      }

      return {
        role: "tool",
        content: normalizeMessageContent(toolResult.toolResult.result),
        tool_call_id: toolResult.toolResult.toolCallId,
      };
    }

    // Handle other roles
    const base: OpenAIMessage = {
      role: (
        {
          SYSTEM: "system",
          USER: "user",
          AI: "assistant",
        } as const
      )[prompt.role],
      content: prompt.content
        .filter(
          (part): part is TextPart & { __typename: "TextContentPart" } =>
            part.__typename === "TextContentPart"
        )
        .map((part) => part.text.text)
        .join("\n"),
    };

    // Find tool calls in content
    const toolCalls = prompt.content
      .filter(
        (part): part is ToolCallPart & { __typename: "ToolCallContentPart" } =>
          part.__typename === "ToolCallContentPart"
      )
      .map((part) => ({
        id: part.toolCall.toolCallId,
        function: {
          name: part.toolCall.toolCall.name,
          arguments:
            typeof part.toolCall.toolCall.arguments === "string"
              ? JSON.parse(part.toolCall.toolCall.arguments)
              : part.toolCall.toolCall.arguments,
        },
      }));

    if (toolCalls.length > 0) {
      return {
        ...base,
        tool_calls: toolCalls,
      };
    }

    return base;
  }
);

/**
 * Hub → Spoke: Convert an OpenAI message to Prompt format
 */
export const openAIMessageToPrompt = openAIMessageSchema.transform(
  (openai): PromptMessage => {
    const content: PromptContentPart[] = [];

    // Convert content to text part
    if (openai.content) {
      content.push({
        __typename: "TextContentPart",
        text: {
          text: openai.content,
        },
      });
    }

    // Convert tool calls
    if (openai.tool_calls) {
      openai.tool_calls.forEach((tc) => {
        content.push({
          __typename: "ToolCallContentPart",
          toolCall: {
            toolCallId: tc.id,
            toolCall: {
              name: tc.function.name,
              arguments:
                typeof tc.function.arguments === "string"
                  ? tc.function.arguments
                  : JSON.stringify(tc.function.arguments),
            },
          },
        });
      });
    }

    return {
      role: openai.role as PromptMessageRole,
      content,
    };
  }
);

type MessageProvider = ModelProvider | "UNKNOWN";

type MessageWithProvider =
  | {
      provider: Extract<ModelProvider, "OPENAI" | "AZURE_OPENAI">;
      validatedMessage: OpenAIMessage;
    }
  | {
      provider: Extract<ModelProvider, "ANTHROPIC">;
      validatedMessage: AnthropicMessage;
    }
  | {
      provider: Extract<ModelProvider, "GEMINI">;
      validatedMessage: JSONLiteral;
    }
  | { provider: "UNKNOWN"; validatedMessage: null };

/**
 * Detect the provider of a message object
 */
export const detectMessageProvider = (
  message: unknown
): MessageWithProvider => {
  const { success: openaiSuccess, data: openaiData } =
    openAIMessageSchema.safeParse(message);
  if (openaiSuccess) {
    return {
      // we cannot disambiguate between azure openai and openai here
      provider: "OPENAI",
      validatedMessage: openaiData,
    };
  }
  const { success: anthropicSuccess, data: anthropicData } =
    anthropicMessageSchema.safeParse(message);
  if (anthropicSuccess) {
    return {
      provider: "ANTHROPIC",
      validatedMessage: anthropicData,
    };
  }
  return { provider: "UNKNOWN", validatedMessage: null };
};

/**
 * Convert from any message format to OpenAI format if possible
 */
export const toOpenAIMessage = (
  message: LlmProviderMessage
): OpenAIMessage | null => {
  const { provider, validatedMessage } = detectMessageProvider(message);
  switch (provider as MessageProvider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      return validatedMessage as OpenAIMessage;
    case "ANTHROPIC":
      return anthropicMessageToOpenAI.parse(validatedMessage);
    case "GEMINI":
      // TODO: Add Gemini message support
      return null;
    case "UNKNOWN":
      return null;
  }
  // This will never happen due to the exhaustive switch above
  return assertUnreachable(provider as never);
};

/**
 * Convert from OpenAI message format to any other format
 */
export const fromOpenAIMessage = <T extends ModelProvider>({
  message,
  targetProvider,
}: {
  message: OpenAIMessage;
  targetProvider: T;
}): ProviderToMessageMap[T] => {
  switch (targetProvider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      return message as ProviderToMessageMap[T];
    case "ANTHROPIC":
      return openAIMessageToAnthropic.parse(message) as ProviderToMessageMap[T];
    case "GEMINI":
      // TODO: Add Gemini message support
      return message as ProviderToMessageMap[T];
    default:
      return assertUnreachable(targetProvider);
  }
};

/**
 * Union of all message formats
 */
export const llmProviderMessageSchema = z.union([
  openAIMessageSchema,
  anthropicMessageSchema,
  promptMessageSchema,
  jsonLiteralSchema,
]);

export type LlmProviderMessage = z.infer<typeof llmProviderMessageSchema>;

type ProviderToMessageMap = {
  OPENAI: OpenAIMessage;
  AZURE_OPENAI: OpenAIMessage;
  ANTHROPIC: AnthropicMessage;
  // Use generic JSON type for unknown message formats / new providers
  GEMINI: JSONLiteral;
};

/**
 * Convert an Anthropic message to Prompt format via OpenAI
 */
export const anthropicMessageToPrompt = anthropicMessageSchema.transform(
  (anthropic): PromptMessage =>
    openAIMessageToPrompt.parse(anthropicMessageToOpenAI.parse(anthropic))
);

/**
 * Convert a Prompt message to Anthropic format via OpenAI
 */
export const promptMessageToAnthropic = promptMessageSchema.transform(
  (prompt): AnthropicMessage =>
    openAIMessageToAnthropic.parse(promptMessageToOpenAI.parse(prompt))
);
