import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { PromptModelProvider } from "../../types/prompts";
import { assertUnreachable } from "../../utils/assertUnreachable";
import {
  asToolResultPart,
  imagePartSchema,
  makeTextPart,
  makeToolCallPart,
  makeToolResultPart,
} from "../../schemas/llm/promptSchemas";

import { JSONLiteral, jsonLiteralSchema } from "./jsonLiteralSchema";
import {
  textPartSchema,
  type ToolCallPart,
  toolCallPartSchema,
  type ToolResultPart,
  toolResultPartSchema,
} from "./promptSchemas";
import {
  OpenAIToolCall,
  anthropicToolCallToOpenAI,
  fromPromptToolCallPart,
  openAIToolCallSchema,
  openAIToolCallToAnthropic,
} from "./toolCallSchemas";
import {
  AnthropicMessagePart,
  AnthropicToolUseBlock,
  OpenAIChatPart,
  OpenAIChatPartImage,
  OpenAIChatPartText,
  anthropicMessagePartSchema,
  openAIChatPartToAnthropicMessagePart,
  openaiChatPartImageSchema,
  openaiChatPartTextSchema,
  promptMessagePartToOpenAIChatPart,
  toOpenAIChatPart,
} from "./messagePartSchemas";
import { safelyStringifyJSON } from "../../utils/safelyStringifyJSON";
import invariant from "tiny-invariant";

/**
 *
 * OpenAI Message Schemas
 *
 */
export const openAIMessageRoleSchema = z.enum([
  "system",
  "user",
  "assistant",
  "developer",
  "tool",
  // "function",
]);

export type OpenAIMessageRole = z.infer<typeof openAIMessageRoleSchema>;

export const openAIMessageSchema = z.discriminatedUnion("role", [
  z
    .object({
      role: z.literal("assistant"),
      content: z.union([openaiChatPartTextSchema.array(), z.string()]),
      name: z.string().optional(),
      tool_call_id: z.string().optional(),
      tool_calls: z.array(openAIToolCallSchema).optional(),
    })
    .passthrough(),
  z
    .object({
      role: z.literal("tool"),
      content: z.union([openaiChatPartTextSchema.array(), z.string()]),
      tool_call_id: z.string(),
    })
    .passthrough(),
  z
    .object({
      role: z.literal("function"),
      content: z.string().nullable(),
      name: z.string().optional(),
    })
    .passthrough(),
  z
    .object({
      role: z.literal("user"),
      content: z.union([
        z.array(z.union([openaiChatPartTextSchema, openaiChatPartImageSchema])),
        z.string(),
      ]),
      name: z.string().optional(),
    })
    .passthrough(),
  z
    .object({
      role: z.literal("system"),
      content: z.union([openaiChatPartTextSchema.array(), z.string()]),
      name: z.string().optional(),
    })
    .passthrough(),
  z
    .object({
      role: z.literal("developer"),
      content: z.union([openaiChatPartTextSchema.array(), z.string()]),
      name: z.string().optional(),
    })
    .passthrough(),
]);

export type OpenAIMessage = z.infer<typeof openAIMessageSchema>;

export const openAIMessagesSchema = z.array(openAIMessageSchema);

export const openAIMessagesJSONSchema = zodToJsonSchema(openAIMessagesSchema, {
  removeAdditionalStrategy: "passthrough",
});

/**
 *
 * Anthropic Message Schemas
 *
 */
export const anthropicMessageRoleSchema = z.enum(["user", "assistant"]);

export type AnthropicMessageRole = z.infer<typeof anthropicMessageRoleSchema>;

export const anthropicMessageSchema = z
  .object({
    role: anthropicMessageRoleSchema,
    content: z.union([z.string(), z.array(anthropicMessagePartSchema)]),
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
 *
 * Prompt Message Schemas
 *
 */

export const promptMessageRoleSchema = z.enum(["SYSTEM", "USER", "AI", "TOOL"]);

export type PromptMessageRole = z.infer<typeof promptMessageRoleSchema>;

export const promptContentPartSchema = z.discriminatedUnion("type", [
  textPartSchema,
  imagePartSchema,
  toolCallPartSchema,
  toolResultPartSchema,
]);

export type PromptContentPart = z.infer<typeof promptContentPartSchema>;

export const promptMessageSchema = z
  .object({
    role: promptMessageRoleSchema,
    content: promptContentPartSchema.array(),
  })
  .passthrough();

export type PromptMessage = z.infer<typeof promptMessageSchema>;

export const promptMessagesSchema = z.array(promptMessageSchema);

export const promptMessagesJSONSchema = zodToJsonSchema(promptMessagesSchema, {
  removeAdditionalStrategy: "passthrough",
});

/*
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
    let role = openAIMessageRoleSchema.parse(anthropic.role);

    if (
      Array.isArray(anthropic.content) &&
      anthropic.content.some((part) => part.type === "tool_result")
    ) {
      role = "tool";
    }

    const initialContentArray: AnthropicMessagePart[] =
      typeof anthropic.content === "string"
        ? [{ type: "text", text: anthropic.content }]
        : anthropic.content;
    const toolCallParts = initialContentArray.filter(
      (part): part is AnthropicToolUseBlock => part.type === "tool_use"
    );
    const nonToolCallParts = initialContentArray.filter(
      (part) => part.type !== "tool_use"
    );

    invariant(
      role === "user" || role === "assistant",
      `Unexpected anthropic role: ${role}`
    );

    switch (role) {
      case "assistant": {
        const content = nonToolCallParts
          .map((part) => toOpenAIChatPart(part))
          .filter(
            (part): part is OpenAIChatPartText =>
              part !== null && part.type === "text"
          );
        return {
          role: "assistant",
          tool_calls:
            toolCallParts.length > 0
              ? toolCallParts.map((tc) => anthropicToolCallToOpenAI.parse(tc))
              : undefined,
          content,
        };
      }
      case "user": {
        const content = nonToolCallParts
          .map((part) => toOpenAIChatPart(part))
          .filter((part): part is OpenAIChatPart => part !== null);
        return {
          role: "user",
          content,
        };
      }
      default:
        return assertUnreachable(role);
    }
  }
);

/**
 * Hub → Spoke: Convert an OpenAI message to Anthropic format
 */
export const openAIMessageToAnthropic = openAIMessageSchema.transform(
  (openai): AnthropicMessage => {
    let role = openai.role;
    const content: AnthropicMessagePart[] = [];

    // convert all roles except assistant to user
    if (openai.role !== "assistant") {
      role = "user";
    }

    invariant(
      role === "user" || role === "assistant",
      `Unexpected openai role: ${role}`
    );
    if (typeof openai.content === "string" && openai.role !== "tool") {
      content.push({ type: "text", text: openai.content });
    } else if (Array.isArray(openai.content)) {
      openai.content.forEach((part) => {
        if (part.type === "text" || part.type === "image_url") {
          const parsedPart = openAIChatPartToAnthropicMessagePart.parse(part);
          if (parsedPart) {
            content.push(parsedPart);
          }
        }
      });
    }

    let toolCallParts: AnthropicToolUseBlock[] = [];
    if (openai.role === "assistant" && "tool_calls" in openai) {
      toolCallParts =
        openai.tool_calls?.map((tc) => openAIToolCallToAnthropic.parse(tc)) ??
        [];
    }
    if (toolCallParts.length > 0) {
      toolCallParts.forEach((tc) => {
        content.push(tc);
      });
    }

    if (openai.role === "tool") {
      content.push({
        type: "tool_result",
        tool_use_id: openai.tool_call_id,
        content: openai.content,
      });
    }

    return {
      role,
      content,
    };
  }
);

/**
 * Spoke → Hub: Convert a Prompt message to OpenAI format
 */
export const promptMessageToOpenAI = promptMessageSchema.transform((prompt) => {
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
      content:
        typeof toolResult.tool_result.result === "string"
          ? toolResult.tool_result.result
          : safelyStringifyJSON(toolResult.tool_result.result).json || "",
      tool_call_id: toolResult.tool_result.tool_call_id,
    } satisfies OpenAIMessage;
  }

  // Handle other roles
  const role = prompt.role;
  switch (role) {
    case "SYSTEM":
      return {
        role: "system",
        content: prompt.content
          .map((part) => promptMessagePartToOpenAIChatPart.parse(part))
          .filter(
            (part): part is OpenAIChatPartText =>
              part !== null && part.type === "text"
          ),
      } satisfies OpenAIMessage;
    case "USER":
      return {
        role: "user",
        content: prompt.content
          .map((part) => promptMessagePartToOpenAIChatPart.parse(part))
          .filter(
            (part): part is OpenAIChatPartText | OpenAIChatPartImage =>
              part !== null &&
              (part.type === "text" || part.type === "image_url")
          ),
      } satisfies OpenAIMessage;
    case "AI":
      return {
        role: "assistant",
        content: prompt.content
          .map((part) => promptMessagePartToOpenAIChatPart.parse(part))
          .filter(
            (part): part is OpenAIChatPartText =>
              part !== null && part.type === "text"
          ),
        tool_calls: prompt.content.some((part) => part.type === "tool_call")
          ? prompt.content
              .filter((part): part is ToolCallPart => part.type === "tool_call")
              .map((part) => fromPromptToolCallPart(part, "OPENAI"))
              .filter((part): part is OpenAIToolCall => part !== null)
          : undefined,
      } satisfies OpenAIMessage;
    default:
      return assertUnreachable(role);
  }
});

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
        content.push(toolResultPart);
      }
      return {
        role: "TOOL",
        content,
      };
    }

    // Convert content to text part if it exists
    if (typeof openai.content === "string") {
      const textPart = makeTextPart(openai.content);
      if (textPart) {
        content.push(textPart);
      }
    } else if (Array.isArray(openai.content)) {
      openai.content.forEach((part) => {
        if (part.type === "text") {
          const textPart = makeTextPart(part.text);
          if (textPart) {
            content.push(textPart);
          }
        }
      });
    }

    // Convert tool calls if they exist
    if (openai.role === "assistant" && openai.tool_calls) {
      openai.tool_calls.forEach((tc) => {
        const toolCallPart = makeToolCallPart({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        });
        if (toolCallPart) {
          content.push(toolCallPart);
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

type MessageProvider = PromptModelProvider | "UNKNOWN";

type MessageWithProvider =
  | {
      provider: Extract<PromptModelProvider, "OPENAI" | "AZURE_OPENAI">;
      validatedMessage: OpenAIMessage;
    }
  | {
      provider: Extract<PromptModelProvider, "ANTHROPIC">;
      validatedMessage: AnthropicMessage;
    }
  | {
      provider: Extract<PromptModelProvider, "GEMINI">;
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
  const messageProvider = provider as MessageProvider;
  switch (messageProvider) {
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
    default:
      return assertUnreachable(messageProvider);
  }
};

/**
 * Convert from OpenAI message format to any other format
 */
export const fromOpenAIMessage = <T extends PromptModelProvider>({
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
