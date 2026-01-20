import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { ModelProviders } from "@phoenix/constants/generativeConstants";
import { assertUnreachable } from "@phoenix/typeUtils";
import { formatContentAsString } from "@phoenix/utils/jsonUtils";
import {
  asTextPart,
  asToolCallPart,
  asToolResultPart,
  makeTextPart,
  makeToolCallPart,
  makeToolResultPart,
} from "@phoenix/utils/promptUtils";

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
  awsToolCallSchema,
  openAIToolCallSchema,
  openAIToolCallToAnthropic,
  openAIToolCallToAws,
} from "./toolCallSchemas";

type ModelProvider = keyof typeof ModelProviders;

/**
 * This file contains the schemas for the different message format SDKs.
 *
 * It is not used for playground validation / transformations.
 *
 * It is likely not complete, and may drift from the actual provider SDKs.
 */

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
 * AWS Message Schemas
 */
export const awsMessageSchema = z
  .object({
    role: z.enum(["user", "assistant", "tool"]),
    content: z.array(z.unknown()),
    tool_call_id: z.string().optional(),
    tool_calls: z.array(awsToolCallSchema).optional(),
  })
  .passthrough();

export type AwsMessage = z.infer<typeof awsMessageSchema>;

export const awsMessagesSchema = z.array(awsMessageSchema);

export const awsMessagesJSONSchema = zodToJsonSchema(awsMessagesSchema, {
  removeAdditionalStrategy: "passthrough",
});

/**
 * Anthropic Message Schemas
 */
export const anthropicMessageRoleSchema = z.enum(["user", "assistant", "tool"]);

export type AnthropicMessageRole = z.infer<typeof anthropicMessageRoleSchema>;

/**
 * Object that represents all possible Anthropic message block type schemas
 *
 * @todo use discriminated union instead of including all properties as optional
 */
export const anthropicMessageBlockSchema = anthropicToolCallSchema.extend({
  type: z.string(),
  text: z.string().optional(),
  id: z.string().optional(),
  tool_use_id: z.string().optional(),
  name: z.string().optional(),
  input: z.record(z.unknown()).optional(),
  source: z
    .object({
      type: z.string(),
      media_type: z.string().optional(),
      data: z.string().optional(),
    })
    .optional(),
});

export const anthropicMessageSchema = z.object({
  role: anthropicMessageRoleSchema,
  content: z.union([z.string(), z.array(anthropicMessageBlockSchema)]),
});

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
 * Hub → Spoke: Convert an OpenAI message to Anthropic format
 */
export const openAIMessageToAws = openAIMessageSchema.transform(
  (openai): AwsMessage => {
    const base = {
      role: openai.role === "assistant" ? "assistant" : "user",
      content: openai.content ? [{ type: "text", text: openai.content }] : [],
    } satisfies AwsMessage;

    if (openai.tool_calls) {
      return {
        role: openai.role === "assistant" ? "assistant" : "user",
        content: openai.content ? [{ type: "text", text: openai.content }] : [],
        tool_calls: openai.tool_calls.map((tc) =>
          openAIToolCallToAws.parse(tc)
        ),
      };
    }

    return base;
  }
);

export const openAIMessageToAnthropic = openAIMessageSchema.transform(
  (openai): AnthropicMessage => {
    const base = {
      role: openai.role === "assistant" ? "assistant" : "user",
      content: openai.content ? [{ type: "text", text: openai.content }] : [],
    } satisfies AnthropicMessage;

    if (openai.tool_calls) {
      return {
        ...base,
        content: [
          ...base.content,
          ...openai.tool_calls.map((tc) => openAIToolCallToAnthropic.parse(tc)),
        ],
      };
    }

    if (openai.tool_call_id) {
      return {
        ...base,
        content: [
          {
            type: "tool_result",
            tool_use_id: openai.tool_call_id,
            content: openai.content,
          },
        ],
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
      const toolResult = prompt.content
        .map((part) => asToolResultPart(part))
        .find((part): part is ToolResultPart => !!part);

      if (!toolResult) {
        throw new Error("TOOL role message must have a ToolResultContentPart");
      }

      return {
        role: "tool",
        content: formatContentAsString(toolResult.toolResult.result),
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
          TOOL: "tool",
        } as const
      )[prompt.role],
      content: prompt.content
        .map((part) => asTextPart(part))
        .filter((text): text is TextPart => !!text)
        .map((part) => part.text.text)
        .join("\n"),
    };

    // Find tool calls in content
    const toolCalls = prompt.content
      .map((part) => asToolCallPart(part))
      .filter((part): part is ToolCallPart => !!part)
      .map((part) => ({
        id: part.toolCall.toolCallId,
        type: "function" as const,
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

    // Special handling for tool messages
    if (openai.role === "tool" && openai.tool_call_id) {
      const toolResultPart = makeToolResultPart(
        openai.tool_call_id,
        openai.content
      );
      if (toolResultPart) {
        content.push({
          __typename: "ToolResultContentPart",
          ...toolResultPart,
        });
      }
      return {
        role: "TOOL",
        content,
      };
    }

    // Convert content to text part if it exists
    if (openai.content) {
      const textPart = makeTextPart(openai.content);
      if (textPart) {
        content.push({
          __typename: "TextContentPart",
          ...textPart,
        });
      }
    }

    // Convert tool calls if they exist
    if (openai.tool_calls) {
      openai.tool_calls.forEach((tc) => {
        const toolCallPart = makeToolCallPart({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        });
        if (toolCallPart) {
          content.push({
            __typename: "ToolCallContentPart",
            ...toolCallPart,
          });
        }
      });
    }

    // Map roles
    const roleMap = {
      system: "SYSTEM",
      user: "USER",
      assistant: "AI",
      tool: "TOOL",
      developer: "SYSTEM", // Map developer to SYSTEM
      function: "TOOL", // Map function to TOOL
    } as const;

    return {
      role: roleMap[openai.role] as PromptMessageRole,
      content,
    };
  }
);

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
      provider: Extract<ModelProvider, "GOOGLE">;
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
    case "DEEPSEEK":
    case "XAI":
    case "OLLAMA":
      return message as ProviderToMessageMap[T];
    case "ANTHROPIC":
      return openAIMessageToAnthropic.parse(message) as ProviderToMessageMap[T];
    case "AWS":
      return openAIMessageToAws.parse(message) as ProviderToMessageMap[T];
    case "GOOGLE":
      // TODO: Add Google message support
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
  DEEPSEEK: OpenAIMessage;
  XAI: OpenAIMessage;
  OLLAMA: OpenAIMessage;
  AWS: AwsMessage;
  ANTHROPIC: AnthropicMessage;
  // Use generic JSON type for unknown message formats / new providers
  GOOGLE: JSONLiteral;
};

/**
 * Convert a Prompt message to Anthropic format via OpenAI
 */
export const promptMessageToAnthropic = promptMessageSchema.transform(
  (prompt): AnthropicMessage =>
    openAIMessageToAnthropic.parse(promptMessageToOpenAI.parse(prompt))
);
