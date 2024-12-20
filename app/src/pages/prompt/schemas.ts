import { z } from "zod";

export const PromptChatMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

export type PromptChatMessage = z.infer<typeof PromptChatMessageSchema>;

export const PromptChatTemplateSchema = z.object({
  _version: z.string(),
  messages: z.array(PromptChatMessageSchema),
});

export type PromptChatTemplate = z.infer<typeof PromptChatTemplateSchema>;
