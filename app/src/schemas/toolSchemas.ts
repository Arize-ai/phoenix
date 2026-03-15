import { z } from "zod";

import { jsonLiteralSchema } from "./jsonLiteralSchema";

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
  type: z.enum(["object", "string", "number", "boolean"]),
  properties: z
    .record(
      z.string(),
      z.union([
        jsonSchemaPropertiesSchema,
        z
          .object({ anyOf: z.array(jsonSchemaPropertiesSchema) })
          .describe("A list of possible parameter names to their definitions"),
      ])
    )
    .optional(),
  required: z.array(z.string()).optional().describe("The required parameters"),
  additionalProperties: z
    .boolean()
    .optional()
    .describe("Whether or not additional properties are allowed in the schema"),
});

/**
 * The schema for an OpenAI tool definition
 * @see https://platform.openai.com/docs/guides/structured-outputs/supported-schemas
 *
 * Note: The nested passThrough's are used to allow for extra keys in JSON schema, however, they do not actually
 * allow for extra keys when the zod schema is used for parsing. This is to allow more flexibility for users
 * to define their own tools according
 */
export const openAIToolDefinitionSchema = z.looseObject({
  type: z.literal("function").describe("The type of the tool"),
  function: z
    .looseObject({
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
    .describe("The function definition"),
});

/**
 * The type of an OpenAI tool definition
 * @see https://platform.openai.com/docs/guides/structured-outputs/supported-schemas
 */
export type OpenAIToolDefinition = z.infer<typeof openAIToolDefinitionSchema>;

/**
 * The JSON schema for an OpenAI tool definition
 */
export const openAIToolDefinitionJSONSchema = z.toJSONSchema(
  openAIToolDefinitionSchema
);

/**
 * The zod schema for an OpenAI Responses API tool definition.
 * @see https://platform.openai.com/docs/api-reference/responses/create
 *
 * Unlike the Chat Completions API which nests under a `function` key,
 * the Responses API flattens name, description, and parameters to the top level
 * alongside `type` and `strict`.
 */
export const openAIResponsesToolDefinitionSchema = z.looseObject({
  type: z
    .literal("function")
    .describe("The type of the tool. Always `function`."),
  name: z.string().describe("The name of the function to call."),
  parameters: jsonSchemaZodSchema
    .nullable()
    .describe(
      "A JSON schema object describing the parameters of the function."
    ),
  strict: z
    .boolean()
    .nullable()
    .describe(
      "Whether to enforce strict parameter validation. Default `true`."
    ),
  description: z
    .string()
    .optional()
    .describe(
      "A description of the function. Used by the model to determine whether or not to call the function."
    ),
});

/**
 * The type of an OpenAI Responses API tool definition
 * @see https://platform.openai.com/docs/api-reference/responses/create
 */
export type OpenAIResponsesToolDefinition = z.infer<
  typeof openAIResponsesToolDefinitionSchema
>;

/**
 * The zod schema for an anthropic tool definition
 */
export const anthropicToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
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
export const anthropicToolDefinitionJSONSchema = z.toJSONSchema(
  anthropicToolDefinitionSchema
);

export const awsToolDefinitionSchema = z.object({
  toolSpec: z.object({
    name: z.string(),
    description: z.string().min(1).optional(),
    inputSchema: z.object({
      json: jsonSchemaZodSchema,
    }),
  }),
});

export type AwsToolDefinition = z.infer<typeof awsToolDefinitionSchema>;

export const awsToolDefinitionJSONSchema = z.toJSONSchema(
  awsToolDefinitionSchema
);

/**
 * The zod schema for a Gemini tool definition.
 * Google GenAI SDK uses `parameters_json_schema`; we accept both for spans
 * that store the raw FunctionDeclaration dump.
 */
export const geminiToolDefinitionSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    parameters: jsonSchemaZodSchema.optional(),
    parameters_json_schema: jsonSchemaZodSchema.optional(),
  })
  .refine((d) => d.parameters != null || d.parameters_json_schema != null, {
    message: "Gemini tool must have parameters or parameters_json_schema",
  });

export type GeminiToolDefinition = z.infer<typeof geminiToolDefinitionSchema>;

/**
 * The JSON schema for a Gemini tool definition
 */
export const geminiToolDefinitionJSONSchema = z.toJSONSchema(
  geminiToolDefinitionSchema
);

/**
 * Union of all tool call formats
 *
 * This is useful for functions that need to accept any tool definition format
 */
export const llmProviderToolDefinitionSchema = z.union([
  openAIToolDefinitionSchema,
  // Responses API must come before Gemini: both have top-level name + parameters,
  // but only Responses API requires type: "function", which Gemini tools lack.
  openAIResponsesToolDefinitionSchema,
  anthropicToolDefinitionSchema,
  awsToolDefinitionSchema,
  geminiToolDefinitionSchema,
  jsonLiteralSchema,
]);

export type LlmProviderToolDefinition = z.infer<
  typeof llmProviderToolDefinitionSchema
>;
