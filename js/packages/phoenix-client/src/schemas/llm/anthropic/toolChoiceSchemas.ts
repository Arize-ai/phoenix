import z from "zod";

/**
 * Anthropic's tool choice schema
 *
 * @see https://docs.anthropic.com/en/api/messages
 */
export const anthropicToolChoiceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tool"),
    name: z.string(),
  }),
  z.object({
    type: z.literal("auto"),
  }),
  z.object({
    type: z.literal("any"),
  }),
]);

export type AnthropicToolChoice = z.infer<typeof anthropicToolChoiceSchema>;
