import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

/**
 * The schema for a tool definition
 * @see https://platform.openai.com/docs/guides/structured-outputs/supported-schemas
 *
 * Note: The nested passThrough's are used to allow for extra keys in JSON schema, however, they do not actually
 * allow for extra keys when the zod schema is used for parsing.
 */
export const toolSchema = z
  .object({
    type: z.literal("function").describe("The type of the tool"),
    function: z
      .object({
        name: z.string().describe("The name of the function"),
        description: z
          .string()
          .optional()
          .describe("A description of the function"),
        parameters: z
          .object({
            type: z.literal("object"),
            properties: z
              .record(
                z
                  .object({
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
                      .array(z.string())
                      .optional()
                      .describe("The allowed values"),
                  })
                  .passthrough()
              )
              .describe("A map of parameter names to their definitions"),
            required: z
              .array(z.string())
              .optional()
              .describe("The required parameters"),
            additionalProperties: z
              .boolean()
              .optional()
              .describe("Whether additional properties are allowed"),
            strict: z
              .boolean()
              .optional()
              .describe("Whether the object should be strict"),
          })
          .passthrough()
          .describe("The parameters that the function accepts"),
      })
      .passthrough()
      .describe("The function definition"),
  })
  .passthrough();

/**
 * The type of a tool definition
 * @see https://platform.openai.com/docs/guides/structured-outputs/supported-schemas
 */
export type ToolDefinition = z.infer<typeof toolSchema>;

/**
 * The JSON schema for a tool definition
 */
export const toolJSONSchema = zodToJsonSchema(toolSchema, {
  removeAdditionalStrategy: "passthrough",
});
