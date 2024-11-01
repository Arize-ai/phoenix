import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { assertUnreachable } from "@phoenix/typeUtils";

const jsonSchemaZodSchema = z
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
            enum: z.array(z.string()).optional().describe("The allowed values"),
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
  })
  .passthrough();

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

/**
 * The JSON schema for an OpenAI tool definition
 */
export const openAIToolDefinitionJSONSchema = zodToJsonSchema(
  openAIToolDefinitionSchema,
  {
    removeAdditionalStrategy: "passthrough",
  }
);

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
 * The JSON schema for an anthropic tool definition
 */
export const anthropicToolDefinitionJSONSchema = zodToJsonSchema(
  anthropicToolDefinitionSchema,
  {
    removeAdditionalStrategy: "passthrough",
  }
);

/**
 * --------------------------------
 * Conversion Schemas
 * --------------------------------
 */

/**
 * Parse incoming object as an Anthropic tool call and immediately convert to OpenAI format
 */
export const anthropicToOpenAI = anthropicToolDefinitionSchema.transform(
  (anthropic): OpenAIToolDefinition => ({
    id: "",
    type: "function",
    function: {
      name: anthropic.name,
      description: anthropic.description,
      parameters: anthropic.input_schema,
    },
  })
);

/**
 * Parse incoming object as an OpenAI tool call and immediately convert to Anthropic format
 */
export const openAIToAnthropic = openAIToolDefinitionSchema.transform(
  (openai): AnthropicToolDefinition => ({
    name: openai.function.name,
    description: openai.function.description ?? openai.function.name,
    input_schema: openai.function.parameters,
  })
);

/**
 * --------------------------------
 * Conversion Helpers
 * --------------------------------
 */

/**
 * Union of all tool call formats
 *
 * This is useful for functions that need to accept any tool definition format
 */
export const llmProviderToolDefinitionSchema = z.union([
  openAIToolDefinitionSchema,
  anthropicToolDefinitionSchema,
]);

export type LlmProviderToolDefinition = z.infer<
  typeof llmProviderToolDefinitionSchema
>;

type ToolDefinitionWithProvider =
  | {
      provider: Extract<ModelProvider, "OPENAI" | "AZURE_OPENAI">;
      validatedToolDefinition: OpenAIToolDefinition;
    }
  | {
      provider: Extract<ModelProvider, "ANTHROPIC">;
      validatedToolDefinition: AnthropicToolDefinition;
    };

/**
 * Detect the provider of a tool call object
 */
export const detectToolDefinitionProvider = (
  toolDefinition: unknown
): ToolDefinitionWithProvider => {
  const { success: openaiSuccess, data: openaiData } =
    openAIToolDefinitionSchema.safeParse(toolDefinition);
  if (openaiSuccess) {
    return {
      provider: "OPENAI",
      validatedToolDefinition: openaiData,
    };
  }
  const { success: anthropicSuccess, data: anthropicData } =
    anthropicToolDefinitionSchema.safeParse(toolDefinition);
  if (anthropicSuccess) {
    return {
      provider: "ANTHROPIC",
      validatedToolDefinition: anthropicData,
    };
  }
  throw new Error("Unknown tool call format");
};

type ProviderToToolDefinitionMap = {
  OPENAI: OpenAIToolDefinition;
  AZURE_OPENAI: OpenAIToolDefinition;
  ANTHROPIC: AnthropicToolDefinition;
};

/**
 * Convert from any tool call format to OpenAI format
 */
export const toOpenAIToolDefinition = (
  toolDefinition: LlmProviderToolDefinition
): OpenAIToolDefinition => {
  const { provider, validatedToolDefinition } =
    detectToolDefinitionProvider(toolDefinition);
  switch (provider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      return validatedToolDefinition;
    case "ANTHROPIC":
      return anthropicToOpenAI.parse(validatedToolDefinition);
    default:
      assertUnreachable(provider);
  }
};

/**
 * Convert from OpenAI tool call format to any other format
 */
export const fromOpenAIToolDefinition = <T extends ModelProvider>({
  toolDefinition,
  targetProvider,
}: {
  toolDefinition: OpenAIToolDefinition;
  targetProvider: T;
}): ProviderToToolDefinitionMap[T] => {
  switch (targetProvider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      return toolDefinition as ProviderToToolDefinitionMap[T];
    case "ANTHROPIC":
      return openAIToAnthropic.parse(
        toolDefinition
      ) as ProviderToToolDefinitionMap[T];
    default:
      assertUnreachable(targetProvider);
  }
};

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
    description: `new_function_${toolNumber}`,
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
