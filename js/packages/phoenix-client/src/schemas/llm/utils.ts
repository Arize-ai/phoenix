import { isObject } from "../../utils/isObject";

import { anthropicMessagePartSchema } from "./anthropic/messagePartSchemas";
import { anthropicMessageSchema } from "./anthropic/messageSchemas";
import { anthropicToolCallSchema } from "./anthropic/toolCallSchemas";
import { anthropicToolChoiceSchema } from "./anthropic/toolChoiceSchemas";
import { anthropicToolDefinitionSchema } from "./anthropic/toolSchemas";
import { openaiChatPartSchema } from "./openai/messagePartSchemas";
import { openAIMessageSchema } from "./openai/messageSchemas";
import { openAIToolCallSchema } from "./openai/toolCallSchemas";
import { openAIToolChoiceSchema } from "./openai/toolChoiceSchemas";
import { openAIToolDefinitionSchema } from "./openai/toolSchemas";
import { phoenixContentPartSchema } from "./phoenixPrompt/messagePartSchemas";
import { phoenixMessageSchema } from "./phoenixPrompt/messageSchemas";
import { phoenixToolCallSchema } from "./phoenixPrompt/toolCallSchemas";
import { phoenixToolChoiceSchema } from "./phoenixPrompt/toolChoiceSchemas";
import { phoenixToolDefinitionSchema } from "./phoenixPrompt/toolSchemas";
import { vercelAIMessageSchema } from "./vercel/messageSchemas";
import { vercelAIToolDefinitionSchema } from "./vercel/toolSchemas";
import { llmProviderToolDefinitionSchema } from "./schemas";
import type {
  LLMMessagePart,
  MessagePartWithProvider,
  MessageWithProvider,
  SDKConverters,
  ToolCallWithProvider,
  ToolChoiceWithProvider,
  ToolDefinitionWithProvider,
} from "./types";

import type { ZodTypeAny } from "zod";

export const makeSDKConverters = <
  MessageSchema extends ZodTypeAny,
  MessagePartSchema extends ZodTypeAny,
  ToolChoiceSchema extends ZodTypeAny,
  ToolCallSchema extends ZodTypeAny,
  ToolDefinitionSchema extends ZodTypeAny,
  ResponseFormatSchema extends ZodTypeAny,
>({
  messages,
  messageParts,
  toolChoices,
  toolCalls,
  toolDefinitions,
  responseFormat,
}: SDKConverters<
  MessageSchema,
  MessagePartSchema,
  ToolChoiceSchema,
  ToolCallSchema,
  ToolDefinitionSchema,
  ResponseFormatSchema
>): SDKConverters<
  MessageSchema,
  MessagePartSchema,
  ToolChoiceSchema,
  ToolCallSchema,
  ToolDefinitionSchema,
  ResponseFormatSchema
> => {
  return {
    messages,
    messageParts,
    toolChoices,
    toolCalls,
    toolDefinitions,
    responseFormat,
  };
};

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
  const { success: vercelSuccess, data: vercelData } =
    vercelAIMessageSchema.safeParse(message);
  if (vercelSuccess) {
    return { provider: "VERCEL_AI", validatedMessage: vercelData };
  }
  const { success: phoenixSuccess, data: phoenixData } =
    phoenixMessageSchema.safeParse(message);
  if (phoenixSuccess) {
    return { provider: "PHOENIX", validatedMessage: phoenixData };
  }
  return { provider: null, validatedMessage: null };
};

export const detectMessagePartProvider = (
  part: LLMMessagePart
): MessagePartWithProvider => {
  const { success: openaiSuccess, data: openaiData } =
    openaiChatPartSchema.safeParse(part);
  if (openaiSuccess) {
    return {
      provider: "OPENAI",
      validatedMessage: openaiData,
    };
  }
  const { success: anthropicSuccess, data: anthropicData } =
    anthropicMessagePartSchema.safeParse(part);
  if (anthropicSuccess) {
    return {
      provider: "ANTHROPIC",
      validatedMessage: anthropicData,
    };
  }
  const { success: phoenixSuccess, data: phoenixData } =
    phoenixContentPartSchema.safeParse(part);
  if (phoenixSuccess) {
    return { provider: "PHOENIX", validatedMessage: phoenixData };
  }
  return { provider: null, validatedMessage: null };
};

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
  const { success: phoenixSuccess, data: phoenixData } =
    phoenixToolCallSchema.safeParse(toolCall);
  if (phoenixSuccess) {
    return { provider: "PHOENIX", validatedToolCall: phoenixData };
  }
  return { provider: null, validatedToolCall: null };
};

/**
 * Detects the provider of a tool choice
 * @param toolChoice the tool choice to detect the provider of
 * @returns the provider of the tool choice
 */
export const detectToolChoiceProvider = (
  toolChoice: unknown
): ToolChoiceWithProvider => {
  const { success: openAISuccess, data: openAIData } =
    openAIToolChoiceSchema.safeParse(toolChoice);
  if (openAISuccess) {
    return { provider: "OPENAI", toolChoice: openAIData };
  }
  const { success: anthropicSuccess, data: anthropicData } =
    anthropicToolChoiceSchema.safeParse(toolChoice);
  if (anthropicSuccess) {
    return { provider: "ANTHROPIC", toolChoice: anthropicData };
  }
  const { success: phoenixSuccess, data: phoenixData } =
    phoenixToolChoiceSchema.safeParse(toolChoice);
  if (phoenixSuccess) {
    return { provider: "PHOENIX", toolChoice: phoenixData };
  }
  return { provider: null, toolChoice: null };
};

/**
 * Detect the provider of a tool call object
 */
export const detectToolDefinitionProvider = (
  toolDefinition: unknown
): ToolDefinitionWithProvider => {
  const { success: openaiSuccess, data: openaiData } =
    openAIToolDefinitionSchema.safeParse(toolDefinition);
  if (openaiSuccess) {
    return {
      // we cannot disambiguate between azure openai and openai here
      provider: "OPENAI",
      validatedToolDefinition: openaiData,
    };
  }
  const { success: anthropicSuccess, data: anthropicData } =
    anthropicToolDefinitionSchema.safeParse(toolDefinition);
  if (anthropicSuccess) {
    return {
      provider: "ANTHROPIC",
      validatedToolDefinition: anthropicData,
    };
  }
  const { success: phoenixSuccess, data: phoenixData } =
    phoenixToolDefinitionSchema.safeParse(toolDefinition);
  if (phoenixSuccess) {
    return { provider: "PHOENIX", validatedToolDefinition: phoenixData };
  }
  const { success: vercelSuccess, data: vercelData } =
    vercelAIToolDefinitionSchema.safeParse(toolDefinition);
  if (vercelSuccess) {
    return { provider: "VERCEL_AI", validatedToolDefinition: vercelData };
  }
  return { provider: null, validatedToolDefinition: null };
};

export const findToolDefinitionName = (toolDefinition: unknown) => {
  const parsed = llmProviderToolDefinitionSchema.safeParse(toolDefinition);
  if (!parsed.success || parsed.data === null || !isObject(parsed.data)) {
    return null;
  }

  if (
    "function" in parsed.data &&
    isObject(parsed.data.function) &&
    "name" in parsed.data.function &&
    typeof parsed.data.function.name === "string"
  ) {
    return parsed.data.function.name;
  }

  if ("name" in parsed.data && typeof parsed.data.name === "string") {
    return parsed.data.name;
  }

  return null;
};

export const findToolDefinitionDescription = (toolDefinition: unknown) => {
  const parsed = llmProviderToolDefinitionSchema.safeParse(toolDefinition);
  if (!parsed.success || parsed.data === null || !isObject(parsed.data)) {
    return null;
  }

  if (
    "function" in parsed.data &&
    isObject(parsed.data.function) &&
    "description" in parsed.data.function &&
    typeof parsed.data.function.description === "string"
  ) {
    return parsed.data.function.description;
  }

  if (
    "description" in parsed.data &&
    typeof parsed.data.description === "string"
  ) {
    return parsed.data.description;
  }

  return null;
};
