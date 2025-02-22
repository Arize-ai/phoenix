import z from "zod";

/*
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
