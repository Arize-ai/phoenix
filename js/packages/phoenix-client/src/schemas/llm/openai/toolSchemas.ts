import { jsonSchemaZodSchema } from "../../jsonSchema";

import z from "zod";

/**
 * The schema for an OpenAI tool definition
 * @see https://platform.openai.com/docs/guides/structured-outputs/supported-schemas
 *
 * Note: The nested passThrough's are used to allow for extra keys in JSON schema, however, they do not actually
 * allow for extra keys when the zod schema is used for parsing. This is to allow more flexibility for users
 * to define their own tools according
 */
export const openAIToolDefinitionSchema = z
  .object({
    type: z.literal("function").describe("The type of the tool"),
    function: z
      .object({
        name: z.string().describe("The name of the function"),
        description: z
          .string()
          .optional()
          .describe("A description of the function"),
        parameters: jsonSchemaZodSchema
          .extend({
            strict: z
              .boolean()
              .optional()
              .describe(
                "Whether or not the arguments should exactly match the function definition, only supported for OpenAI models"
              ),
          })
          .describe("The parameters that the function accepts"),
      })
      .passthrough()
      .describe("The function definition"),
  })
  .passthrough();

/**
 * The type of an OpenAI tool definition
 * @see https://platform.openai.com/docs/guides/structured-outputs/supported-schemas
 */
export type OpenAIToolDefinition = z.infer<typeof openAIToolDefinitionSchema>;

/*
 *
 * Conversion Helpers
 *
 */

/**
 * Creates an OpenAI tool definition
 * @param toolNumber the number of the tool in that instance for example instance.tools.length + 1 to be used to fill in the name
 * @returns an OpenAI tool definition
 */
export function createOpenAIToolDefinition(
  toolNumber: number
): OpenAIToolDefinition {
  return {
    type: "function",
    function: {
      name: `new_function_${toolNumber}`,
      description: "",
      parameters: {
        type: "object",
        properties: {
          new_arg: {
            type: "string",
          },
        },
        required: [],
      },
    },
  };
}
