import z from "zod";

const jsonSchemaPropertiesSchema = z
  .looseObject({
    type: z
      .enum([
        "string",
        "number",
        "boolean",
        "object",
        "array",
        "null",
        "integer",
      ])
      .describe("The type of the parameter"),
    description: z
      .string()
      .optional()
      .describe("A description of the parameter"),
    enum: z.array(z.string()).optional().describe("The allowed values"),
  })
  .describe("A map of parameter names to their definitions");

export const jsonSchemaZodSchema = z.looseObject({
  type: z.literal("object"),
  properties: z.record(
    z.string(),
    z.union([
      jsonSchemaPropertiesSchema,
      z
        .object({ anyOf: z.array(jsonSchemaPropertiesSchema) })
        .describe("A list of possible parameter names to their definitions"),
    ])
  ),
  required: z.array(z.string()).optional().describe("The required parameters"),
  additionalProperties: z
    .boolean()
    .optional()
    .describe("Whether or not additional properties are allowed in the schema"),
});
