import { jsonSchemaZodSchema } from "../../jsonSchema";

import z from "zod";

/**
 * The zod schema for an anthropic tool definition
 */
export const anthropicToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: jsonSchemaZodSchema,
});

/**
 * The type of an anthropic tool definition
 */
export type AnthropicToolDefinition = z.infer<
  typeof anthropicToolDefinitionSchema
>;

/**
 * Creates an Anthropic tool definition
 * @param toolNumber the number of the tool in that instance for example instance.tools.length + 1 to be used to fill in the name
 * @returns an Anthropic tool definition
 */
export function createAnthropicToolDefinition(
  toolNumber: number
): AnthropicToolDefinition {
  return {
    name: `new_function_${toolNumber}`,
    description: "",
    input_schema: {
      type: "object",
      properties: {
        new_arg: {
          type: "string",
        },
      },
      required: [],
    },
  };
}
