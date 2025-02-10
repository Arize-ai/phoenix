import { z } from "zod";
import { jsonSchemaZodSchema } from "./toolSchemas";

/*
 *
 * Reponse format zod schemas
 *
 */

/**
 * Phoenix response format schema
 */
export const phoenixResponseFormatSchema = z.object({
  type: z.literal("response-format-json-schema"),
  name: z.string(),
  description: z.string().optional(),
  schema: z.object({
    type: z.literal("json-schema-draft-7-object-schema"),
    json: jsonSchemaZodSchema,
  }),
  extra_parameters: z.record(z.unknown()).optional(),
});

export type PhoenixResponseFormat = z.infer<typeof phoenixResponseFormatSchema>;

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

/*
 *
 * Conversion functions
 *
 */

export const phoenixResponseFormatToOpenAI =
  phoenixResponseFormatSchema.transform(
    (phoenix): OpenAIResponseFormat => ({
      type: "json_schema",
      json_schema: {
        name: phoenix.name,
        description: phoenix.description,
        schema: phoenix.schema.json,
      },
    })
  );
