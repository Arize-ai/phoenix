import { z } from "zod";
import { anthropicToolCallSchema } from "./toolCallSchemas";
import { assertUnreachable } from "../../utils/assertUnreachable";
import { PhoenixModelProvider } from "../../constants";
import { promptPartSchema } from "./promptSchemas";

/**
 *
 * OpenAI Message Part Schemas
 *
 */

export const openaiChatPartTextSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export type OpenAIChatPartText = z.infer<typeof openaiChatPartTextSchema>;

export const openaiChatPartImageSchema = z.object({
  type: z.literal("image_url"),
  image_url: z.object({
    url: z.string(),
  }),
});

export type OpenAIChatPartImage = z.infer<typeof openaiChatPartImageSchema>;

export const openaiChatPartSchema = z.discriminatedUnion("type", [
  openaiChatPartTextSchema,
  openaiChatPartImageSchema,
]);

export type OpenAIChatPart = z.infer<typeof openaiChatPartSchema>;

/**
 *
 * Anthropic Message Part Schemas
 *
 */

export const anthropicTextBlockSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export type AnthropicTextBlock = z.infer<typeof anthropicTextBlockSchema>;

export const anthropicImageBlockSchema = z.object({
  type: z.literal("image"),
  source: z.object({
    data: z.string(),
    media_type: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
    type: z.literal("base64"),
  }),
});

export type AnthropicImageBlock = z.infer<typeof anthropicImageBlockSchema>;

export const anthropicToolUseBlockSchema = anthropicToolCallSchema;

export type AnthropicToolUseBlock = z.infer<typeof anthropicToolUseBlockSchema>;

export const anthropicToolResultBlockSchema = z.object({
  type: z.literal("tool_result"),
  tool_use_id: z.string(),
  content: z.union([
    z.string(),
    z.union([anthropicTextBlockSchema, anthropicImageBlockSchema]).array(),
  ]),
  is_error: z.boolean().optional(),
});

export type AnthropicToolResultBlock = z.infer<
  typeof anthropicToolResultBlockSchema
>;

export const anthropicMessagePartSchema = z.discriminatedUnion("type", [
  anthropicTextBlockSchema,
  anthropicImageBlockSchema,
  anthropicToolUseBlockSchema,
  anthropicToolResultBlockSchema,
]);

export type AnthropicMessagePart = z.infer<typeof anthropicMessagePartSchema>;

export type LLMMessagePart = OpenAIChatPart | AnthropicMessagePart;

/*
 *
 * Hub and Spoke Message Part Transformers
 *
 */

export const promptMessagePartToOpenAIChatPart = promptPartSchema.transform(
  (part) => {
    const type = part.type;
    switch (type) {
      case "text":
        return {
          type: "text",
          text: part.text.text,
        } satisfies OpenAIChatPartText;
      case "tool_call":
        return null;
      case "tool_result":
        return null;
      case "image":
        return {
          type: "image_url",
          image_url: { url: part.image.url },
        } satisfies OpenAIChatPartImage;
      default:
        return assertUnreachable(type);
    }
  }
);

export const anthropicMessagePartToOpenAIChatPart =
  anthropicMessagePartSchema.transform((anthropic) => {
    const type = anthropic.type;
    switch (type) {
      case "text":
        return {
          type: "text",
          text: anthropic.text,
        } satisfies OpenAIChatPartText;
      case "image":
        return {
          type: "image_url",
          image_url: { url: anthropic.source.data },
        } satisfies OpenAIChatPartImage;
      case "tool_use":
        return null;
      case "tool_result":
        return null;
      default:
        return assertUnreachable(type);
    }
  });

export const openAIChatPartToAnthropicMessagePart =
  openaiChatPartSchema.transform((openai) => {
    const type = openai.type;
    switch (type) {
      case "text":
        return { type: "text", text: openai.text } satisfies AnthropicTextBlock;
      case "image_url": {
        if (!openai.image_url.url.startsWith("data:image/")) {
          return null;
        }
        let mediaType: "jpeg" | "png" | "gif" | "webp" | "jpg" =
          openai.image_url.url?.split(";")?.[0]?.split("/")[1] as
            | "jpeg"
            | "png"
            | "gif"
            | "webp"
            | "jpg";
        if (
          mediaType !== "jpeg" &&
          mediaType !== "jpg" &&
          mediaType !== "png" &&
          mediaType !== "gif" &&
          mediaType !== "webp"
        ) {
          return null;
        }
        if (mediaType === "jpg") {
          mediaType = "jpeg" as const;
        }
        return {
          type: "image",
          source: {
            data: openai.image_url.url,
            media_type: `image/${mediaType}`,
            type: "base64",
          },
        } satisfies AnthropicImageBlock;
      }
      default:
        return assertUnreachable(type);
    }
  });

export type MessagePartProvider = PhoenixModelProvider | "UNKNOWN";

export type MessagePartWithProvider =
  | {
      provider: Extract<PhoenixModelProvider, "OPENAI" | "AZURE_OPENAI">;
      validatedMessage: OpenAIChatPart;
    }
  | {
      provider: Extract<PhoenixModelProvider, "ANTHROPIC">;
      validatedMessage: AnthropicMessagePart;
    }
  | { provider: "UNKNOWN"; validatedMessage: null };

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
