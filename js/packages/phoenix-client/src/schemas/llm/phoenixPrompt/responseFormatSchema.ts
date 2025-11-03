import { PromptResponseFormat } from "../../../types/prompts";
import { schemaMatches } from "../../../utils/schemaMatches";

import z from "zod";

/**
 * Phoenix response format schema
 */
export const phoenixResponseFormatSchema =
  schemaMatches<PromptResponseFormat>()(
    z.object({
      type: z.literal("json_schema"),
      json_schema: z.object({
        name: z.string(),
        description: z.string().optional(),
        schema: z.record(z.unknown()).optional(),
        strict: z.boolean().optional(),
      }),
    })
  );

export type PhoenixResponseFormat = z.infer<typeof phoenixResponseFormatSchema>;
