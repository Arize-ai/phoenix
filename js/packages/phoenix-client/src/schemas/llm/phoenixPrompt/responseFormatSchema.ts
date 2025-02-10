import z from "zod";
import { jsonSchemaZodSchema } from "../../jsonSchema";

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
