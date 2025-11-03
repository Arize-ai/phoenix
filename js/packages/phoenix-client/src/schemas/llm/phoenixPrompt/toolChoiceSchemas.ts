import { PromptToolChoice } from "../../../types/prompts";
import { schemaMatches } from "../../../utils/schemaMatches";

import z from "zod";

/**
 * Phoenix's tool choice schema
 */
export const phoenixToolChoiceSchema = schemaMatches<PromptToolChoice>()(
  z.union([
    z.object({
      type: z.literal("none"),
    }),
    z.object({
      type: z.literal("zero_or_more"),
    }),
    z.object({
      type: z.literal("one_or_more"),
    }),
    z.object({
      type: z.literal("specific_function"),
      function_name: z.string(),
    }),
  ])
);

export type PhoenixToolChoice = z.infer<typeof phoenixToolChoiceSchema>;
