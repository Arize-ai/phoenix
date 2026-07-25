import invariant from "tiny-invariant";
import type z from "zod";

import { assertUnreachable } from "../../utils/assertUnreachable";
import { safelyParseJSON } from "../../utils/safelyParseJSON";
import type { JSONLiteral } from "../jsonLiteralSchema";
import { SDKProviderConverterMap } from "./constants";
import type { OpenAIChatPart } from "./openai/messagePartSchemas";
import type { OpenAIMessage } from "./openai/messageSchemas";
import type { OpenAIToolCall } from "./openai/toolCallSchemas";
import type { OpenaiToolChoice } from "./openai/toolChoiceSchemas";
import type { OpenAIToolDefinition } from "./openai/toolSchemas";
import { toolCallHeuristicSchema } from "./schemas";
import type { LLMMessagePart, PromptSDKFormat } from "./types";
import {
  detectMessagePartProvider,
  detectMessageProvider,
  detectToolCallProvider,
  detectToolChoiceProvider,
  detectToolDefinitionProvider,
} from "./utils";

export const safelyConvertMessageToProvider = <
  TargetProviderSDK extends NonNullable<PromptSDKFormat>,
>({
  message,
  targetProvider,
}: {
  message: unknown;
  targetProvider: TargetProviderSDK;
}) => {
  try {
    // convert incoming message to OpenAI format
    const openAIMessage = toOpenAIMessage(message);
    invariant(
      openAIMessage != null,
      `Could not convert message to ${targetProvider} format`
    );
    // convert the OpenAI format to the target provider format
    return fromOpenAIMessage({ message: openAIMessage, targetProvider });
  } catch {
    return null;
  }
};

export const safelyConvertToolCallToProvider = <
  TargetProviderSDK extends NonNullable<PromptSDKFormat>,
>({
  toolCall,
  targetProvider,
}: {
  toolCall: unknown;
  targetProvider: TargetProviderSDK;
}) => {
  try {
    // convert incoming tool call to OpenAI format
    const openAIToolCall = toOpenAIToolCall(toolCall);
    invariant(
      openAIToolCall != null,
      `Could not convert tool call to ${targetProvider} format`
    );
    // convert the OpenAI format to the target provider format
    return fromOpenAIToolCall({
      toolCall: openAIToolCall,
      targetProvider,
    });
  } catch {
    return null;
  }
};

export const safelyConvertToolDefinitionToProvider = <
  TargetProviderSDK extends NonNullable<PromptSDKFormat>,
>({
  toolDefinition,
  targetProvider,
}: {
  toolDefinition: unknown;
  targetProvider: TargetProviderSDK;
}) => {
  try {
    // convert incoming tool definition to OpenAI format
    const openAIToolDefinition = toOpenAIToolDefinition(toolDefinition);
    invariant(
      openAIToolDefinition != null,
      `Could not convert tool definition to ${targetProvider} format`
    );
    // convert the OpenAI format to the target provider format
    return fromOpenAIToolDefinition({
      toolDefinition: openAIToolDefinition,
      targetProvider,
    });
  } catch {
    return null;
  }
};

export const safelyConvertToolChoiceToProvider = <
  TargetProviderSDK extends NonNullable<PromptSDKFormat>,
>({
  toolChoice,
  targetProvider,
}: {
  toolChoice: unknown;
  targetProvider: TargetProviderSDK;
}) => {
  try {
    // convert incoming tool choice to OpenAI format
    const openAIToolChoice = toOpenAIToolChoice(toolChoice);
    invariant(
      openAIToolChoice != null,
      `Could not convert tool choice to ${targetProvider} format`
    );
    // convert the OpenAI format to the target provider format
    return fromOpenAIToolChoice({
      toolChoice: openAIToolChoice,
      targetProvider,
    });
  } catch {
    return null;
  }
};

export const toOpenAIChatPart = (
  part: LLMMessagePart
): OpenAIChatPart | null => {
  const { provider, validatedMessage } = detectMessagePartProvider(part);
  switch (provider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      return validatedMessage;
    case "ANTHROPIC":
      return SDKProviderConverterMap.ANTHROPIC.messageParts.toOpenAI.parse(
        validatedMessage
      );
    case "PHOENIX":
      return SDKProviderConverterMap.PHOENIX.messageParts.toOpenAI.parse(
        validatedMessage
      );
    case "VERCEL_AI":
      return SDKProviderConverterMap.VERCEL_AI.messageParts.toOpenAI.parse(
        validatedMessage
      );
    case null:
      return null;
    default:
      return assertUnreachable(provider);
  }
};

/**
 * Convert from any message format to OpenAI format if possible
 */
export const toOpenAIMessage = (message: unknown): OpenAIMessage | null => {
  const { provider, validatedMessage } = detectMessageProvider(message);
  switch (provider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      return validatedMessage as OpenAIMessage;
    case "ANTHROPIC":
      return SDKProviderConverterMap.ANTHROPIC.messages.toOpenAI.parse(
        validatedMessage
      );
    case "PHOENIX":
      return SDKProviderConverterMap.PHOENIX.messages.toOpenAI.parse(
        validatedMessage
      );
    case "VERCEL_AI":
      return SDKProviderConverterMap.VERCEL_AI.messages.toOpenAI.parse(
        validatedMessage
      );
    case null:
      return null;
    default:
      return assertUnreachable(provider);
  }
};

/**
 * Convert from OpenAI message format to any other format
 */
/**
 * Per-SDK conversions from the OpenAI message format.
 *
 * This is a mapped type over the SDK union rather than a `switch`, because
 * indexing it with the type parameter yields a function returning exactly
 * `messages.fromOpenAI`s output for that SDK. Neither a `switch` on a generic
 * value nor a direct index of `SDKProviderConverterMap` can express that -- both
 * collapse to a union and need a cast. A missing SDK is a compile error here,
 * which replaces the previous `assertUnreachable` default.
 */
const FROM_OPENAI_MESSAGE_CONVERTERS: {
  [P in NonNullable<PromptSDKFormat>]: (
    message: OpenAIMessage
  ) => z.infer<(typeof SDKProviderConverterMap)[P]["messages"]["fromOpenAI"]>;
} = {
  OPENAI: (message) =>
    SDKProviderConverterMap.OPENAI.messages.fromOpenAI.parse(message),
  AZURE_OPENAI: (message) =>
    SDKProviderConverterMap.AZURE_OPENAI.messages.fromOpenAI.parse(message),
  ANTHROPIC: (message) =>
    SDKProviderConverterMap.ANTHROPIC.messages.fromOpenAI.parse(message),
  PHOENIX: (message) =>
    SDKProviderConverterMap.PHOENIX.messages.fromOpenAI.parse(message),
  VERCEL_AI: (message) =>
    SDKProviderConverterMap.VERCEL_AI.messages.fromOpenAI.parse(message),
};

export const fromOpenAIMessage = <
  TargetProviderSDK extends NonNullable<PromptSDKFormat>,
>({
  message,
  targetProvider,
}: {
  message: OpenAIMessage;
  targetProvider: TargetProviderSDK;
}): z.infer<
  (typeof SDKProviderConverterMap)[TargetProviderSDK]["messages"]["fromOpenAI"]
> => FROM_OPENAI_MESSAGE_CONVERTERS[targetProvider](message);

/**
 * Converts a tool call to the OpenAI format if possible
 * @param maybeToolCall a tool call from an unknown LlmProvider
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
      return SDKProviderConverterMap.ANTHROPIC.toolCalls.toOpenAI.parse(
        validatedToolCall
      );
    case "PHOENIX":
      return SDKProviderConverterMap.PHOENIX.toolCalls.toOpenAI.parse(
        validatedToolCall
      );
    case "VERCEL_AI":
      return SDKProviderConverterMap.VERCEL_AI.toolCalls.toOpenAI.parse(
        validatedToolCall
      );
    case null:
      return null;
    default:
      return assertUnreachable(provider);
  }
};

/**
 * Converts a tool call to a target provider format
 * @param params the parameters object
 * @param params.toolCall the tool call to convert
 * @param params.targetProvider the provider to convert the tool call to
 * @returns the tool call in the target provider format
 */
// See comment on fromOpenAIMessage for why `as ReturnType` casts are needed.
/**
 * Per-SDK conversions from the OpenAI toolCall format.
 *
 * This is a mapped type over the SDK union rather than a `switch`, because
 * indexing it with the type parameter yields a function returning exactly
 * `toolCalls.fromOpenAI`s output for that SDK. Neither a `switch` on a generic
 * value nor a direct index of `SDKProviderConverterMap` can express that -- both
 * collapse to a union and need a cast. A missing SDK is a compile error here,
 * which replaces the previous `assertUnreachable` default.
 */
const FROM_OPENAI_TOOL_CALL_CONVERTERS: {
  [P in NonNullable<PromptSDKFormat>]: (
    toolCall: OpenAIToolCall
  ) => z.infer<(typeof SDKProviderConverterMap)[P]["toolCalls"]["fromOpenAI"]>;
} = {
  OPENAI: (toolCall) =>
    SDKProviderConverterMap.OPENAI.toolCalls.fromOpenAI.parse(toolCall),
  AZURE_OPENAI: (toolCall) =>
    SDKProviderConverterMap.AZURE_OPENAI.toolCalls.fromOpenAI.parse(toolCall),
  ANTHROPIC: (toolCall) =>
    SDKProviderConverterMap.ANTHROPIC.toolCalls.fromOpenAI.parse(toolCall),
  PHOENIX: (toolCall) =>
    SDKProviderConverterMap.PHOENIX.toolCalls.fromOpenAI.parse(toolCall),
  VERCEL_AI: (toolCall) =>
    SDKProviderConverterMap.VERCEL_AI.toolCalls.fromOpenAI.parse(toolCall),
};

export const fromOpenAIToolCall = <
  TargetProviderSDK extends NonNullable<PromptSDKFormat>,
>({
  toolCall,
  targetProvider,
}: {
  toolCall: OpenAIToolCall;
  targetProvider: TargetProviderSDK;
}): z.infer<
  (typeof SDKProviderConverterMap)[TargetProviderSDK]["toolCalls"]["fromOpenAI"]
> => FROM_OPENAI_TOOL_CALL_CONVERTERS[targetProvider](toolCall);

/**
 * Converts a tool choice to the OpenAI format
 * @param toolChoice a tool choice from an unknown LlmProvider
 * @returns the tool choice parsed to the OpenAI format
 */
export const toOpenAIToolChoice = (
  toolChoice: unknown
): OpenaiToolChoice | null => {
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
      return SDKProviderConverterMap.ANTHROPIC.toolChoices.toOpenAI.parse(
        validatedToolChoice
      );
    case "PHOENIX":
      return SDKProviderConverterMap.PHOENIX.toolChoices.toOpenAI.parse(
        validatedToolChoice
      );
    case "VERCEL_AI":
      return SDKProviderConverterMap.VERCEL_AI.toolChoices.toOpenAI.parse(
        validatedToolChoice
      );
    default:
      return assertUnreachable(provider);
  }
};

/**
 * Converts a tool choice to a target provider format
 * @param params the parameters object
 * @param params.toolChoice the tool choice to convert
 * @param params.targetProvider the provider to convert the tool choice to
 * @returns the tool choice in the target provider format
 */
// See comment on fromOpenAIMessage for why `as ReturnType` casts are needed.
/**
 * Per-SDK conversions from the OpenAI toolChoice format.
 *
 * This is a mapped type over the SDK union rather than a `switch`, because
 * indexing it with the type parameter yields a function returning exactly
 * `toolChoices.fromOpenAI`s output for that SDK. Neither a `switch` on a generic
 * value nor a direct index of `SDKProviderConverterMap` can express that -- both
 * collapse to a union and need a cast. A missing SDK is a compile error here,
 * which replaces the previous `assertUnreachable` default.
 */
const FROM_OPENAI_TOOL_CHOICE_CONVERTERS: {
  [P in NonNullable<PromptSDKFormat>]: (
    toolChoice: OpenaiToolChoice
  ) => z.infer<
    (typeof SDKProviderConverterMap)[P]["toolChoices"]["fromOpenAI"]
  >;
} = {
  OPENAI: (toolChoice) =>
    SDKProviderConverterMap.OPENAI.toolChoices.fromOpenAI.parse(toolChoice),
  AZURE_OPENAI: (toolChoice) =>
    SDKProviderConverterMap.AZURE_OPENAI.toolChoices.fromOpenAI.parse(
      toolChoice
    ),
  ANTHROPIC: (toolChoice) =>
    SDKProviderConverterMap.ANTHROPIC.toolChoices.fromOpenAI.parse(toolChoice),
  PHOENIX: (toolChoice) =>
    SDKProviderConverterMap.PHOENIX.toolChoices.fromOpenAI.parse(toolChoice),
  VERCEL_AI: (toolChoice) =>
    SDKProviderConverterMap.VERCEL_AI.toolChoices.fromOpenAI.parse(toolChoice),
};

export const fromOpenAIToolChoice = <
  TargetProviderSDK extends NonNullable<PromptSDKFormat>,
>({
  toolChoice,
  targetProvider,
}: {
  toolChoice: OpenaiToolChoice;
  targetProvider: TargetProviderSDK;
}): z.infer<
  (typeof SDKProviderConverterMap)[TargetProviderSDK]["toolChoices"]["fromOpenAI"]
> => FROM_OPENAI_TOOL_CHOICE_CONVERTERS[targetProvider](toolChoice);

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
      return SDKProviderConverterMap.OPENAI.toolDefinitions.toOpenAI.parse(
        validatedToolDefinition
      );
    case "ANTHROPIC":
      return SDKProviderConverterMap.ANTHROPIC.toolDefinitions.toOpenAI.parse(
        validatedToolDefinition
      );
    case "PHOENIX":
      return SDKProviderConverterMap.PHOENIX.toolDefinitions.toOpenAI.parse(
        validatedToolDefinition
      );
    case "VERCEL_AI":
      return SDKProviderConverterMap.VERCEL_AI.toolDefinitions.toOpenAI.parse(
        validatedToolDefinition
      );
    case null:
      return null;
    default:
      return assertUnreachable(provider);
  }
};

/**
 * Convert from OpenAI tool call format to any other format
 */
// See comment on fromOpenAIMessage for why `as ReturnType` casts are needed.
/**
 * Per-SDK conversions from the OpenAI toolDefinition format.
 *
 * This is a mapped type over the SDK union rather than a `switch`, because
 * indexing it with the type parameter yields a function returning exactly
 * `toolDefinitions.fromOpenAI`s output for that SDK. Neither a `switch` on a generic
 * value nor a direct index of `SDKProviderConverterMap` can express that -- both
 * collapse to a union and need a cast. A missing SDK is a compile error here,
 * which replaces the previous `assertUnreachable` default.
 */
const FROM_OPENAI_TOOL_DEFINITION_CONVERTERS: {
  [P in NonNullable<PromptSDKFormat>]: (
    toolDefinition: OpenAIToolDefinition
  ) => z.infer<
    (typeof SDKProviderConverterMap)[P]["toolDefinitions"]["fromOpenAI"]
  >;
} = {
  OPENAI: (toolDefinition) =>
    SDKProviderConverterMap.OPENAI.toolDefinitions.fromOpenAI.parse(
      toolDefinition
    ),
  AZURE_OPENAI: (toolDefinition) =>
    SDKProviderConverterMap.AZURE_OPENAI.toolDefinitions.fromOpenAI.parse(
      toolDefinition
    ),
  ANTHROPIC: (toolDefinition) =>
    SDKProviderConverterMap.ANTHROPIC.toolDefinitions.fromOpenAI.parse(
      toolDefinition
    ),
  PHOENIX: (toolDefinition) =>
    SDKProviderConverterMap.PHOENIX.toolDefinitions.fromOpenAI.parse(
      toolDefinition
    ),
  VERCEL_AI: (toolDefinition) =>
    SDKProviderConverterMap.VERCEL_AI.toolDefinitions.fromOpenAI.parse(
      toolDefinition
    ),
};

export const fromOpenAIToolDefinition = <
  TargetProviderSDK extends NonNullable<PromptSDKFormat>,
>({
  toolDefinition,
  targetProvider,
}: {
  toolDefinition: OpenAIToolDefinition;
  targetProvider: TargetProviderSDK;
}): z.infer<
  (typeof SDKProviderConverterMap)[TargetProviderSDK]["toolDefinitions"]["fromOpenAI"]
> => FROM_OPENAI_TOOL_DEFINITION_CONVERTERS[targetProvider](toolDefinition);

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
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- heuristic tool-call arguments are untyped JSON trusted to be a JSONLiteral
      ((heuristic.data.arguments ??
        heuristic.data.function?.arguments) as JSONLiteral) ?? null
    );
  }

  return null;
}
