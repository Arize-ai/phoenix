import { z } from "zod";

import { assertUnreachable, isObject, schemaForType } from "@phoenix/typeUtils";

/**
 * OpenAI's tool choice schema
 *
 * @see https://platform.openAI.com/docs/api-reference/chat/create#chat-create-tool_choice
 */
export const openAIToolChoiceSchema = schemaForType<ToolChoice>()(
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

export type OpenaiToolChoice = z.infer<typeof openAIToolChoiceSchema>;

export const awsToolChoiceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("auto"),
  }),
  z.object({
    type: z.literal("any"),
  }),
  z.object({
    type: z.literal("tool"),
    name: z.string(),
  }),
  z.object({
    type: z.literal("none"),
  }),
]);

export type AwsToolChoice = z.infer<typeof awsToolChoiceSchema>;

/**
 * Anthropic's tool choice schema
 *
 * @see https://docs.anthropic.com/en/api/messages
 */
export const anthropicToolChoiceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("none"),
  }),
  z.object({
    type: z.literal("auto"),
    disable_parallel_tool_use: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("any"),
    disable_parallel_tool_use: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("tool"),
    name: z.string(),
    disable_parallel_tool_use: z.boolean().optional(),
  }),
]);

export type AnthropicToolChoice = z.infer<typeof anthropicToolChoiceSchema>;

/**
 * Google's tool choice schema
 * Google supports:
 * - Simple string values: "auto", "any", "none" for mode selection
 * - Object with tool name for specific tool selection
 */
export const googleToolChoiceSchema = z.union([
  z.literal("auto"),
  z.literal("any"),
  z.literal("none"),
  z.object({
    name: z.string(),
  }),
]);

export type GoogleToolChoice = z.infer<typeof googleToolChoiceSchema>;

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
      case "none":
        return "none";
      default:
        return "auto";
    }
  });

export const openAIToolChoiceToAwsToolChoice = openAIToolChoiceSchema.transform(
  (openAI): AwsToolChoice => {
    if (isObject(openAI)) {
      return { type: "tool", name: openAI.function.name };
    }
    switch (openAI) {
      case "none":
        return { type: "none" };
      case "auto":
        return { type: "auto" };
      case "required":
        return { type: "any" };
      default:
        assertUnreachable(openAI);
    }
  }
);

export const openAIToolChoiceToAnthropicToolChoice =
  openAIToolChoiceSchema.transform((openAI): AnthropicToolChoice => {
    if (isObject(openAI)) {
      return { type: "tool", name: openAI.function.name };
    }
    switch (openAI) {
      case "none":
        return { type: "none" };
      case "auto":
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
  googleToolChoiceSchema,
]);

export type LlmProviderToolChoice = z.infer<typeof llmProviderToolChoiceSchema>;

export type ToolChoiceWithProvider =
  | {
      provider: "OPENAI";
      toolChoice: OpenaiToolChoice;
    }
  | { provider: "AZURE_OPENAI"; toolChoice: OpenaiToolChoice }
  | { provider: "ANTHROPIC"; toolChoice: AnthropicToolChoice }
  | { provider: "GOOGLE"; toolChoice: GoogleToolChoice }
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
  const { success: googleSuccess, data: googleData } =
    googleToolChoiceSchema.safeParse(toolChoice);
  if (googleSuccess) {
    return { provider: "GOOGLE", toolChoice: googleData };
  }
  return { provider: null, toolChoice: null };
};

type ProviderToToolChoiceMap = {
  OPENAI: OpenaiToolChoice;
  AZURE_OPENAI: OpenaiToolChoice;
  ANTHROPIC: AnthropicToolChoice;
  GOOGLE: GoogleToolChoice;
  DEEPSEEK: OpenaiToolChoice;
  XAI: OpenaiToolChoice;
  OLLAMA: OpenaiToolChoice;
  AWS: AwsToolChoice;
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
    case "GOOGLE":
      // Convert Google choice to OpenAI format
      if (isObject(validatedToolChoice) && "name" in validatedToolChoice) {
        // Specific tool selection
        return {
          type: "function",
          function: { name: validatedToolChoice.name },
        };
      }
      switch (validatedToolChoice) {
        case "any":
          return "required";
        case "auto":
          return "auto";
        case "none":
          return "none";
        default:
          assertUnreachable(validatedToolChoice);
      }
      break;
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
    case "DEEPSEEK":
    case "XAI":
    case "OLLAMA":
      return toolChoice as ProviderToToolChoiceMap[T];
    case "AWS":
      return openAIToolChoiceToAwsToolChoice.parse(
        toolChoice
      ) as ProviderToToolChoiceMap[T];
    case "ANTHROPIC":
      return openAIToolChoiceToAnthropicToolChoice.parse(
        toolChoice
      ) as ProviderToToolChoiceMap[T];
    case "GOOGLE":
      // Convert OpenAI choice to Google format
      if (isObject(toolChoice)) {
        // Specific tool selection
        return { name: toolChoice.function.name } as ProviderToToolChoiceMap[T];
      }
      switch (toolChoice) {
        case "required":
          return "any" as ProviderToToolChoiceMap[T];
        case "auto":
          return "auto" as ProviderToToolChoiceMap[T];
        case "none":
          return "none" as ProviderToToolChoiceMap[T];
        default:
          assertUnreachable(toolChoice);
      }
      break;
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
    const openAIToolChoice = toOpenAIToolChoice(toolChoice);
    // convert the OpenAI format to the target provider format
    return fromOpenAIToolChoice({
      toolChoice: openAIToolChoice,
      targetProvider,
    });
  } catch (_e) {
    return null;
  }
};

export const makeOpenAIToolChoice = (
  toolChoice: OpenaiToolChoice
): OpenaiToolChoice => {
  return toolChoice;
};

export const makeAnthropicToolChoice = (
  toolChoice: AnthropicToolChoice
): AnthropicToolChoice => {
  return toolChoice;
};

export const makeAwsToolChoice = (toolChoice: AwsToolChoice): AwsToolChoice => {
  return toolChoice;
};

export const makeGoogleToolChoice = (
  toolChoice: GoogleToolChoice
): GoogleToolChoice => {
  return toolChoice;
};

export const findToolChoiceName = (toolChoice: unknown): string | null => {
  if (isObject(toolChoice)) {
    // OpenAI format: { type: "function", function: { name: "..." } }
    if (
      "function" in toolChoice &&
      isObject(toolChoice.function) &&
      "name" in toolChoice.function &&
      typeof toolChoice.function.name === "string"
    ) {
      return toolChoice.function.name;
    }
    // Anthropic/AWS/Google format: { name: "..." } or { type: "tool", name: "..." }
    if ("name" in toolChoice && typeof toolChoice.name === "string") {
      return toolChoice.name;
    }
    return null;
  }
  return null;
};
