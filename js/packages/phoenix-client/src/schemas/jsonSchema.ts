import z from "zod";

import { type JSONLiteral, literalSchema } from "./jsonLiteralSchema";

const jsonEnumValueSchema: z.ZodType<JSONLiteral> = z.lazy(() =>
  z.union([
    literalSchema,
    z.array(jsonEnumValueSchema),
    z.custom<Record<string, JSONLiteral>>(
      (value) =>
        value !== null &&
        typeof value === "object" &&
        z.record(z.string(), z.unknown()).safeParse(value).success &&
        Object.values(value).every(
          (entry) => jsonEnumValueSchema.safeParse(entry).success
        )
    ),
  ])
);

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
    enum: z
      .array(jsonEnumValueSchema)
      .optional()
      .describe("The allowed values"),
  })
  .describe("A map of parameter names to their definitions");

export const jsonSchemaZodSchema = z.looseObject({
  type: z.literal("object"),
  properties: z.record(
    z.string(),
    z.union([
      jsonSchemaPropertiesSchema,
      z
        .looseObject({ anyOf: z.array(jsonSchemaPropertiesSchema) })
        .describe("A list of possible parameter names to their definitions"),
    ])
  ),
  required: z.array(z.string()).optional().describe("The required parameters"),
  additionalProperties: z
    .boolean()
    .optional()
    .describe("Whether or not additional properties are allowed in the schema"),
});
