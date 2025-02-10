import { z } from "zod";
import { jsonSchemaZodSchema } from "../../jsonSchema";

/*
 *
 * Reponse format zod schemas
 *
 */

/**
 * OpenAI response format schema
 */
export const openaiResponseFormatSchema = z.object({
  type: z.literal("json_schema"),
  json_schema: z.object({
    name: z.string(),
    description: z.string().optional(),
    schema: jsonSchemaZodSchema,
  }),
});

export type OpenAIResponseFormat = z.infer<typeof openaiResponseFormatSchema>;
