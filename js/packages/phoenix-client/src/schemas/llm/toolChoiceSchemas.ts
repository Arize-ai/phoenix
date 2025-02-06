import { z } from "zod";
import type { PromptModelProvider } from "../../types/prompts";
import { assertUnreachable } from "../../utils/assertUnreachable";
import { isObject } from "../../utils/isObject";

/**
 * Phoenix's tool choice schema
 */
export const phoenixToolChoiceSchema = z.union([
  z.object({
    type: z.literal("none"),
  }),
  z.object({
    type: z.literal("zero-or-more"),
  }),
  z.object({
    type: z.literal("one-or-more"),
  }),
  z.object({
    type: z.literal("specific-function-tool"),
    function_name: z.string(),
  }),
]);

export type PhoenixToolChoice = z.infer<typeof phoenixToolChoiceSchema>;

/**
 * OpenAI's tool choice schema
 *
 * @see https://platform.openAI.com/docs/api-reference/chat/create#chat-create-tool_choice
 */
export const openAIToolChoiceSchema = z.union([
  z.literal("auto"),
  z.literal("none"),
  z.literal("required"),
  z.object({
    type: z.literal("function"),
    function: z.object({ name: z.string() }),
  }),
]);

export type OpenaiToolChoice = z.infer<typeof openAIToolChoiceSchema>;

/**
 * Anthropic's tool choice schema
 *
 * @see https://docs.anthropic.com/en/api/messages
 */
export const anthropicToolChoiceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tool"),
    name: z.string(),
    disable_parallel_tool_use: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("auto"),
    disable_parallel_tool_use: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("any"),
    disable_parallel_tool_use: z.boolean().optional(),
  }),
]);

export type AnthropicToolChoice = z.infer<typeof anthropicToolChoiceSchema>;

/*
 *
 * Conversion Helpers
 *
 */

export const phoenixToolChoiceToOpenaiToolChoice =
  phoenixToolChoiceSchema.transform((phoenix): OpenaiToolChoice => {
    switch (phoenix.type) {
      case "none":
        return "none";
      case "zero-or-more":
        return "auto";
      case "one-or-more":
        return "required";
      case "specific-function-tool":
        return { type: "function", function: { name: phoenix.function_name } };
    }
  });

export const anthropicToolChoiceToOpenaiToolChoice =
  anthropicToolChoiceSchema.transform((anthropic): OpenaiToolChoice => {
    switch (anthropic.type) {
      case "any":
        return "required";
      case "auto":
        return "auto";
      case "tool":
        if (!anthropic.name) {
          return "auto";
        }
        return {
          type: "function",
          function: { name: anthropic.name },
        };
      default:
        return "auto";
    }
  });

export const openAIToolChoiceToAnthropicToolChoice =
  openAIToolChoiceSchema.transform((openAI): AnthropicToolChoice => {
    if (isObject(openAI)) {
      return { type: "tool", name: openAI.function.name };
    }
    switch (openAI) {
      case "auto":
        return { type: "auto" };
      case "none":
        return { type: "auto" };
      case "required":
        return { type: "any" };
      default:
        assertUnreachable(openAI);
    }
  });

export const llmProviderToolChoiceSchema = z.union([
  openAIToolChoiceSchema,
  anthropicToolChoiceSchema,
]);

export type LlmProviderToolChoice = z.infer<typeof llmProviderToolChoiceSchema>;

export type ToolChoiceWithProvider =
  | {
      provider: "OPENAI";
      toolChoice: OpenaiToolChoice;
    }
  | { provider: "AZURE_OPENAI"; toolChoice: OpenaiToolChoice }
  | { provider: "ANTHROPIC"; toolChoice: AnthropicToolChoice }
  | { provider: null; toolChoice: null };

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

type ProviderToToolChoiceMap = {
  OPENAI: OpenaiToolChoice;
  AZURE_OPENAI: OpenaiToolChoice;
  ANTHROPIC: AnthropicToolChoice;
  // TODO(apowell): #5348 Add Gemini tool choice schema
  GEMINI: OpenaiToolChoice;
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
