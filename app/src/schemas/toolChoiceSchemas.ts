import { z } from "zod";

import { assertUnreachable, schemaForType } from "@phoenix/typeUtils";

/**
 * OpenAI's tool choice schema
 *
 * @see https://platform.openai.com/docs/api-reference/chat/create#chat-create-tool_choice
 */
export const openaiToolChoiceSchema = schemaForType<ToolChoice>()(
  z.union([
    z.literal("auto"),
    z.literal("none"),
    z.literal("required"),
    z.object({
      type: z.literal("function"),
      function: z.object({ name: z.string() }),
    }),
  ])
);

export type OpenaiToolChoice = z.infer<typeof openaiToolChoiceSchema>;

/**
 * Anthropic's tool choice schema
 *
 * @see https://docs.anthropic.com/en/api/messages
 */
export const anthropicToolChoiceSchema = z.object({
  type: z.union([z.literal("auto"), z.literal("any"), z.literal("tool")]),
  disable_parallel_tool_use: z.boolean().optional(),
  name: z.string().optional(),
});

export type AnthropicToolChoice = z.infer<typeof anthropicToolChoiceSchema>;

export const anthropicToolChoiceToOpenaiToolChoice =
  anthropicToolChoiceSchema.transform((anthropic): OpenaiToolChoice => {
    switch (anthropic.type) {
      case "any":
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

export const openaiToolChoiceToAnthropicToolChoice =
  openaiToolChoiceSchema.transform((openai): AnthropicToolChoice => {
    if (typeof openai === "string") {
      return { type: "auto" };
    }
    return {
      type: "tool",
      name: openai.function.name,
    };
  });

export const llmProviderToolChoiceSchema = z.union([
  openaiToolChoiceSchema,
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
  const { success: openaiSuccess, data: openaiData } =
    openaiToolChoiceSchema.safeParse(toolChoice);
  if (openaiSuccess) {
    return { provider: "OPENAI", toolChoice: openaiData };
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
export const fromOpenAIToolChoice = <T extends ModelProvider>({
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
      return openaiToolChoiceToAnthropicToolChoice.parse(
        toolChoice
      ) as ProviderToToolChoiceMap[T];
    default:
      assertUnreachable(targetProvider);
  }
};

export const safelyConvertToolChoiceToProvider = <T extends ModelProvider>({
  toolChoice,
  targetProvider,
}: {
  toolChoice: unknown;
  targetProvider: T;
}): ProviderToToolChoiceMap[T] | null => {
  try {
    // convert incoming tool choice to the OpenAI format
    const openaiToolChoice = toOpenAIToolChoice(toolChoice);
    // convert the OpenAI format to the target provider format
    return fromOpenAIToolChoice({
      toolChoice: openaiToolChoice,
      targetProvider,
    });
  } catch (e) {
    return null;
  }
};
