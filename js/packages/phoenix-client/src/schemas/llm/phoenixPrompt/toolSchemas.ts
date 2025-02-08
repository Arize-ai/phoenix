import z from "zod";
import { jsonSchemaZodSchema } from "../../jsonSchema";

/**
 * The Phoenix tool definition schema
 */
export const phoenixToolDefinitionSchema = z.object({
  type: z.literal("function-tool-v1"),
  name: z.string(),
  description: z.string().optional(),
  schema: z.object({
    type: z.literal("json-schema-draft-7-object-schema"),
    json: jsonSchemaZodSchema,
  }),
  extra_parameters: z.record(z.unknown()).optional(),
});
