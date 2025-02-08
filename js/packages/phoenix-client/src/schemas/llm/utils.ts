import { safelyParseJSON } from "../../utils/safelyParseJSON";
import { JSONLiteral } from "../jsonLiteralSchema";
import { anthropicToolCallSchema } from "./anthropic";
import { anthropicMessagePartSchema } from "./anthropic/messagePartSchemas";
import { anthropicMessageSchema } from "./anthropic/messageSchemas";
import { toOpenAIToolCall } from "./converters";
import { openAIToolCallSchema } from "./openai";
import { openaiChatPartSchema } from "./openai/messagePartSchemas";
import { openAIMessageSchema } from "./openai/messageSchemas";
import { openAIToolChoiceSchema } from "./openai/toolChoiceSchemas";
import { anthropicToolChoiceSchema } from "./anthropic/toolChoiceSchemas";
import { openAIToolDefinitionSchema } from "./openai/toolSchemas";
import { anthropicToolDefinitionSchema } from "./anthropic/toolSchemas";
import {
  ToolDefinitionWithProvider,
  llmProviderToolDefinitionSchema,
  toolCallHeuristicSchema,
} from "./schemas";
import {
  LLMMessagePart,
  MessagePartWithProvider,
  MessageWithProvider,
  ToolCallWithProvider,
  ToolChoiceWithProvider,
} from "./types";
import { isObject } from "../../utils/isObject";

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
  return { provider: "UNKNOWN", validatedMessage: null };
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
  return { provider: "UNKNOWN", validatedToolCall: null };
};

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
  return { provider: "UNKNOWN", validatedToolDefinition: null };
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
