import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

/**
 * The schema for an OpenAI tool definition
 * @see https://platform.openai.com/docs/guides/structured-outputs/supported-schemas
 *
 * Note: The nested passThrough's are used to allow for extra keys in JSON schema, however, they do not actually
 * allow for extra keys when the zod schema is used for parsing. This is to allow more flexibility for users
 * to define their own tools according
 */
export const openAIToolSchema = z
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
              .describe(
                "Whether or not additional properties are allowed in the schema"
              ),
            strict: z
              .boolean()
              .optional()
              .describe(
                "Whether or not the arguments should exactly match the function definition, only supported for OpenAI models"
              ),
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
export type OpenAIToolDefinition = z.infer<typeof openAIToolSchema>;

/**
 * The JSON schema for a tool definition
 */
export const openAIToolJSONSchema = zodToJsonSchema(openAIToolSchema, {
  removeAdditionalStrategy: "passthrough",
});

/**
 * The schema for an OpenAI tool call, this is what a message that calls a tool looks like
 *
 * Note: The nested passThrough's are used to allow for extra keys in JSON schema, however, they do not actually
 * allow for extra keys when the zod schema is used for parsing. This is to allow more flexibility for users
 * to define their own tool calls according
 */
export const openAIToolCallSchema = z.object({
  id: z.string().describe("The ID of the tool call"),
  function: z
    .object({
      name: z.string().describe("The name of the function"),
      arguments: z
        .union([z.record(z.unknown()).optional(), z.string()])
        .describe("The arguments for the function"),
    })
    .describe("The function that is being called")
    .passthrough(),
});

/**
 * The type of an OpenAI tool call
 *
 * @example
 * ```typescript
 *  {
 *   id: "1",
 *   function: {
 *     name: "getCurrentWeather",
 *     arguments: "{ \"city\": \"San Francisco\" }"
 *   }
 * }
 * ```
 */
export type OpenAIToolCall = z.infer<typeof openAIToolCallSchema>;

/**
 * The zod schema for multiple OpenAI Tool Calls
 */
export const openAIToolCallsSchema = z.array(openAIToolCallSchema);

/**
 * The JSON schema for multiple OpenAI tool calls
 */
export const openAIToolCallsJSONSchema = zodToJsonSchema(
  openAIToolCallsSchema,
  {
    removeAdditionalStrategy: "passthrough",
  }
);
