import z from "zod";
import { schemaMatches } from "../../../utils/schemaMatches";
import { PromptResponseFormat } from "../../../types/prompts";

/**
 * Phoenix response format schema
 */
export const phoenixPromptResponseFormatSchema =
  schemaMatches<PromptResponseFormat>()(
    z.object({
      type: z.literal("response-format-json-schema"),
      name: z.string(),
      description: z.string().optional(),
      schema: z.object({
        type: z.literal("json-schema-draft-7-object-schema"),
        json: z.record(z.unknown()),
      }),
      extra_parameters: z.record(z.unknown()),
    })
  );

export type PhoenixPromptResponseFormat = z.infer<
  typeof phoenixPromptResponseFormatSchema
>;
