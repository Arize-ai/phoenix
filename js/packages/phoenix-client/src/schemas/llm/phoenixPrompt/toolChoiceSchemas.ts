import z from "zod";
import { schemaMatches } from "../../../utils/schemaMatches";
import { PromptToolChoice } from "../../../types/prompts";

/**
 * Phoenix's tool choice schema
 */
export const phoenixPromptToolChoiceSchema = schemaMatches<PromptToolChoice>()(
  z.union([
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
  ])
);

export type PhoenixPromptToolChoice = z.infer<
  typeof phoenixPromptToolChoiceSchema
>;
