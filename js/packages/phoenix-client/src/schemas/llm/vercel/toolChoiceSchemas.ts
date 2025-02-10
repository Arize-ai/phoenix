import z from "zod";

/**
 * Vercel AI SDK Tool Choice Schema
 */
export const vercelAIToolChoiceSchema = z.union([
  z.literal("auto"),
  z.literal("none"),
  z.literal("required"),
  z.object({
    type: z.literal("tool"),
    toolName: z.string(),
  }),
]);

export type VercelAIToolChoice = z.infer<typeof vercelAIToolChoiceSchema>;
