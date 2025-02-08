import { PromptModelProvider } from "../../types/prompts";
import { assertUnreachable } from "../../utils/assertUnreachable";
import {
  anthropicMessagePartToOpenAIChatPart,
  anthropicMessageToOpenAI,
  anthropicToolCallToOpenAI,
  anthropicToolChoiceToOpenaiToolChoice,
  anthropicToolToOpenAI,
} from "./anthropic";
import {
  openAIMessageToAnthropic,
  openAIToolCallToAnthropic,
  openAIToolChoiceToAnthropicToolChoice,
  openAIToolToAnthropic,
} from "./openai/converters";
import { OpenAIChatPart } from "./openai/messagePartSchemas";
import { OpenAIMessage } from "./openai/messageSchemas";
import { OpenAIToolCall } from "./openai/toolCallSchemas";
import { OpenaiToolChoice } from "./openai/toolChoiceSchemas";
import { OpenAIToolDefinition } from "./openai/toolSchemas";
import { LlmProviderMessage, ProviderToToolDefinitionMap } from "./schemas";
import {
  LLMMessagePart,
  MessageProvider,
  ProviderToMessageMap,
  ProviderToToolCallMap,
  ProviderToToolChoiceMap,
} from "./types";
import {
  detectMessagePartProvider,
  detectMessageProvider,
  detectToolCallProvider,
  detectToolChoiceProvider,
  detectToolDefinitionProvider,
} from "./utils";

export const toOpenAIChatPart = (
  part: LLMMessagePart
): OpenAIChatPart | null => {
  const { provider, validatedMessage } = detectMessagePartProvider(part);
  switch (provider) {
    case "OPENAI":
      return validatedMessage;
    case "ANTHROPIC":
      return anthropicMessagePartToOpenAIChatPart.parse(validatedMessage);
    default:
      return null;
  }
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
export const fromOpenAIToolCall = <T extends PromptModelProvider>({
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
      return openAIToolCallToAnthropic.parse(
        toolCall
      ) as ProviderToToolCallMap[T];
    case "GEMINI":
      return toolCall as ProviderToToolCallMap[T];
    default:
      assertUnreachable(targetProvider);
  }
};

/**
 * Converts a tool choice to the OpenAI format
 * @param toolChoice a tool choice from an unknown LlmProvider
 * @returns the tool choice parsed to the OpenAI format
 */
export const toOpenAIToolChoice = (toolChoice: unknown): OpenaiToolChoice => {
  const { provider, toolChoice: validatedToolChoice } =
    detectToolChoiceProvider(toolChoice);
  if (provider == null || validatedToolChoice == null) {
    throw new Error("Could not detect provider of tool choice");
  }
  switch (provider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      return validatedToolChoice;
    case "ANTHROPIC":
      return anthropicToolChoiceToOpenaiToolChoice.parse(validatedToolChoice);
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
export const fromOpenAIToolChoice = <T extends PromptModelProvider>({
  toolChoice,
  targetProvider,
}: {
  toolChoice: OpenaiToolChoice;
  targetProvider: T;
}): ProviderToToolChoiceMap[T] => {
  switch (targetProvider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      return toolChoice as ProviderToToolChoiceMap[T];
    case "ANTHROPIC":
      return openAIToolChoiceToAnthropicToolChoice.parse(
        toolChoice
      ) as ProviderToToolChoiceMap[T];
    // TODO(apowell): #5348 Add Gemini tool choice
    case "GEMINI":
      return toolChoice as ProviderToToolChoiceMap[T];
    default:
      assertUnreachable(targetProvider);
  }
};

export const safelyConvertToolChoiceToProvider = <
  T extends PromptModelProvider,
>({
  toolChoice,
  targetProvider,
}: {
  toolChoice: unknown;
  targetProvider: T;
}): ProviderToToolChoiceMap[T] | null => {
  try {
    // convert incoming tool choice to the OpenAI format
    const openAIToolChoice = toOpenAIToolChoice(toolChoice);
    // convert the OpenAI format to the target provider format
    return fromOpenAIToolChoice({
      toolChoice: openAIToolChoice,
      targetProvider,
    });
  } catch (e) {
    return null;
  }
};

/**
 * Convert from any tool call format to OpenAI format if possible
 */
export const toOpenAIToolDefinition = (
  toolDefinition: unknown
): OpenAIToolDefinition | null => {
  const { provider, validatedToolDefinition } =
    detectToolDefinitionProvider(toolDefinition);
  switch (provider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      return validatedToolDefinition;
    case "ANTHROPIC":
      return anthropicToolToOpenAI.parse(validatedToolDefinition);
    case "UNKNOWN":
      return null;
    default:
      assertUnreachable(provider);
  }
};

/**
 * Convert from OpenAI tool call format to any other format
 */
export const fromOpenAIToolDefinition = <T extends PromptModelProvider>({
  toolDefinition,
  targetProvider,
}: {
  toolDefinition: OpenAIToolDefinition;
  targetProvider: T;
}): ProviderToToolDefinitionMap[T] => {
  switch (targetProvider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      return toolDefinition as ProviderToToolDefinitionMap[T];
    case "ANTHROPIC":
      return openAIToolToAnthropic.parse(
        toolDefinition
      ) as ProviderToToolDefinitionMap[T];
    // TODO(apowell): #5348 Add Gemini tool calls schema - https://github.com/Arize-ai/phoenix/issues/5348
    case "GEMINI":
      return toolDefinition as ProviderToToolDefinitionMap[T];
    default:
      assertUnreachable(targetProvider);
  }
};
