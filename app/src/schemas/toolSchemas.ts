import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { assertUnreachable, isObject } from "@phoenix/typeUtils";

import { jsonLiteralSchema } from "./jsonLiteralSchema";

const jsonSchemaPropertiesSchema = z
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
  .describe("A map of parameter names to their definitions");

export const jsonSchemaZodSchema = z
  .object({
    type: z.literal("object"),
    properties: z
      .record(
        z.union([
          jsonSchemaPropertiesSchema,
          z
            .object({ anyOf: z.array(jsonSchemaPropertiesSchema) })
            .describe(
              "A list of possible parameter names to their definitions"
            ),
        ])
      )
      .optional(),
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

export const awsToolDefinitionSchema = z.object({
  toolSpec: z.object({
    name: z.string(),
    description: z.string().min(1),
    inputSchema: z.object({
      json: jsonSchemaZodSchema,
    }),
  }),
});

export type AwsToolDefinition = z.infer<typeof awsToolDefinitionSchema>;

export const awsToolDefinitionJSONSchema = zodToJsonSchema(
  awsToolDefinitionSchema,
  {
    removeAdditionalStrategy: "passthrough",
  }
);

/**
 * Gemini schema properties using standard lowercase type values
 */
type GeminiSchemaProperties = {
  type:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "array"
    | "object"
    | "null";
  description?: string;
  enum?: string[];
  format?: string;
  nullable?: boolean;
  items?: GeminiSchemaProperties;
  properties?: Record<string, GeminiSchemaProperties>;
  required?: string[];
  [key: string]: unknown;
};

const geminiSchemaPropertiesSchema: z.ZodType<GeminiSchemaProperties> = z
  .object({
    type: z
      .enum([
        "string",
        "number",
        "integer",
        "boolean",
        "array",
        "object",
        "null",
      ])
      .describe("The type of the parameter"),
    description: z
      .string()
      .optional()
      .describe("A description of the parameter"),
    enum: z.array(z.string()).optional().describe("The allowed values"),
    format: z.string().optional().describe("The format of the data"),
    nullable: z.boolean().optional().describe("Whether the value may be null"),
    items: z
      .lazy(() => geminiSchemaPropertiesSchema)
      .optional()
      .describe("Schema of array elements"),
    properties: z
      .record(z.lazy(() => geminiSchemaPropertiesSchema))
      .optional()
      .describe("Properties of object type"),
    required: z
      .array(z.string())
      .optional()
      .describe("Required properties for object type"),
  })
  .passthrough()
  .describe("A Gemini schema property definition");

const geminiFunctionDeclarationSchema = z.object({
  name: z.string().describe("The name of the function"),
  description: z.string().optional().describe("A description of the function"),
  parameters: geminiSchemaPropertiesSchema
    .optional()
    .describe("The parameters that the function accepts"),
});

/**
 * Gemini tool definition - a single function declaration.
 * The backend will wrap this in a `functionDeclarations` array when sending to Google's API.
 */
export const geminiToolDefinitionSchema = geminiFunctionDeclarationSchema;

export type GeminiToolDefinition = z.infer<typeof geminiToolDefinitionSchema>;

/**
 * The JSON schema for a Gemini tool definition (single function declaration).
 * The backend wraps this in a `functionDeclarations` array before sending to Google's API.
 */
export const geminiToolDefinitionJSONSchema = zodToJsonSchema(
  geminiToolDefinitionSchema,
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
 * Convert Gemini schema to OpenAPI schema (they use the same type values now)
 */
const convertGeminiSchemaToOpenAPI = (
  geminiSchema: GeminiSchemaProperties
): Record<string, unknown> => {
  const openaiSchema: Record<string, unknown> = {
    ...geminiSchema,
  };

  if (geminiSchema.properties) {
    openaiSchema.properties = Object.fromEntries(
      Object.entries(geminiSchema.properties).map(([key, value]) => [
        key,
        convertGeminiSchemaToOpenAPI(value),
      ])
    );
  }

  if (geminiSchema.items) {
    openaiSchema.items = convertGeminiSchemaToOpenAPI(geminiSchema.items);
  }

  return openaiSchema;
};

/**
 * Convert OpenAPI schema to Gemini schema (they use the same type values now)
 */
const convertOpenAPISchemaToGemini = (
  openaiSchema: Record<string, unknown>
): GeminiSchemaProperties => {
  const geminiSchema: Record<string, unknown> = {
    ...openaiSchema,
  };

  if (
    "properties" in openaiSchema &&
    openaiSchema.properties &&
    typeof openaiSchema.properties === "object"
  ) {
    geminiSchema.properties = Object.fromEntries(
      Object.entries(openaiSchema.properties).map(([key, value]) => {
        if (
          typeof value === "object" &&
          value !== null &&
          "anyOf" in value &&
          Array.isArray(value.anyOf) &&
          value.anyOf[0]
        ) {
          // For anyOf, just take the first option for simplicity
          return [
            key,
            convertOpenAPISchemaToGemini(
              value.anyOf[0] as Record<string, unknown>
            ),
          ];
        }
        return [
          key,
          convertOpenAPISchemaToGemini(value as Record<string, unknown>),
        ];
      })
    );
  }

  if (
    "items" in openaiSchema &&
    openaiSchema.items &&
    typeof openaiSchema.items === "object"
  ) {
    geminiSchema.items = convertOpenAPISchemaToGemini(
      openaiSchema.items as Record<string, unknown>
    );
  }

  return geminiSchema as GeminiSchemaProperties;
};

/**
 * Convert a Gemini function declaration to OpenAI format
 */
const convertGeminiToOpenAITool = (
  gemini: GeminiToolDefinition
): OpenAIToolDefinition => {
  const parameters = gemini.parameters
    ? convertGeminiSchemaToOpenAPI(gemini.parameters)
    : { type: "object", properties: {} };

  // Ensure type is "object" for OpenAI compatibility
  if (!parameters.type) {
    parameters.type = "object";
  }

  return {
    type: "function" as const,
    function: {
      name: gemini.name,
      description: gemini.description,
      parameters: parameters as OpenAIToolDefinition["function"]["parameters"],
    },
  };
};

/**
 * Convert an OpenAI tool to Gemini function declaration
 */
const convertOpenAIToGeminiTool = (
  openai: OpenAIToolDefinition
): GeminiToolDefinition => {
  return {
    name: openai.function.name,
    description: openai.function.description,
    parameters: openai.function.parameters
      ? convertOpenAPISchemaToGemini(openai.function.parameters)
      : undefined,
  };
};

export const awsToolToOpenAI = awsToolDefinitionSchema.transform(
  (aws): OpenAIToolDefinition => ({
    type: "function",
    function: {
      name: aws.toolSpec.name,
      description: aws.toolSpec.description,
      parameters: aws.toolSpec.inputSchema.json,
    },
  })
);

export const openAIToolToAws = openAIToolDefinitionSchema.transform(
  (openai): AwsToolDefinition => ({
    toolSpec: {
      name: openai.function.name,
      description: openai.function.description ?? openai.function.name,
      inputSchema: {
        json: openai.function.parameters,
      },
    },
  })
);

/**
 * Parse incoming object as an Anthropic tool call and immediately convert to OpenAI format
 */
export const anthropicToolToOpenAI = anthropicToolDefinitionSchema.transform(
  (anthropic): OpenAIToolDefinition => ({
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
export const openAIToolToAnthropic = openAIToolDefinitionSchema.transform(
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
  awsToolDefinitionSchema,
  geminiToolDefinitionSchema,
  jsonLiteralSchema,
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
    }
  | {
      provider: Extract<ModelProvider, "AWS">;
      validatedToolDefinition: AwsToolDefinition;
    }
  | {
      provider: Extract<ModelProvider, "GOOGLE">;
      validatedToolDefinition: GeminiToolDefinition;
    }
  | {
      provider: "UNKNOWN";
      validatedToolDefinition: null;
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
      // we cannot disambiguate between azure openai and openai here
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

  const { success: awsSuccess, data: awsData } =
    awsToolDefinitionSchema.safeParse(toolDefinition);
  if (awsSuccess) {
    return {
      provider: "AWS",
      validatedToolDefinition: awsData,
    };
  }

  const { success: geminiSuccess, data: geminiData } =
    geminiToolDefinitionSchema.safeParse(toolDefinition);
  if (geminiSuccess) {
    return {
      provider: "GOOGLE",
      validatedToolDefinition: geminiData,
    };
  }

  return { provider: "UNKNOWN", validatedToolDefinition: null };
};

type ProviderToToolDefinitionMap = {
  OPENAI: OpenAIToolDefinition;
  AZURE_OPENAI: OpenAIToolDefinition;
  ANTHROPIC: AnthropicToolDefinition;
  GOOGLE: GeminiToolDefinition;
  DEEPSEEK: OpenAIToolDefinition;
  XAI: OpenAIToolDefinition;
  OLLAMA: OpenAIToolDefinition;
  AWS: AwsToolDefinition;
};

/**
 * Convert from any tool call format to OpenAI format if possible
 */
export const toOpenAIToolDefinition = (
  toolDefinition: LlmProviderToolDefinition
): OpenAIToolDefinition | null => {
  const { provider, validatedToolDefinition } =
    detectToolDefinitionProvider(toolDefinition);
  switch (provider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      return validatedToolDefinition;
    case "ANTHROPIC":
      return anthropicToolToOpenAI.parse(validatedToolDefinition);
    case "AWS":
      return awsToolToOpenAI.parse(validatedToolDefinition);
    case "GOOGLE":
      return convertGeminiToOpenAITool(validatedToolDefinition);
    case "UNKNOWN":
      return null;
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
    case "DEEPSEEK":
    case "XAI":
    case "OLLAMA":
      return toolDefinition as ProviderToToolDefinitionMap[T];
    case "ANTHROPIC":
      return openAIToolToAnthropic.parse(
        toolDefinition
      ) as ProviderToToolDefinitionMap[T];
    case "AWS":
      return openAIToolToAws.parse(
        toolDefinition
      ) as ProviderToToolDefinitionMap[T];
    case "GOOGLE":
      return convertOpenAIToGeminiTool(
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
      description: "a description",
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
    description: "a description",
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

export function createAwsToolDefinition(toolNumber: number): AwsToolDefinition {
  return {
    toolSpec: {
      name: `new_function_${toolNumber}`,
      description: "a description",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            new_arg: {
              type: "string",
            },
          },
          required: [],
        },
      },
    },
  };
}

/**
 * Creates a Gemini tool definition (single function declaration)
 * @param toolNumber the number of the tool in that instance for example instance.tools.length + 1 to be used to fill in the name
 * @returns a Gemini tool definition
 */
export function createGeminiToolDefinition(
  toolNumber: number
): GeminiToolDefinition {
  return {
    name: `new_function_${toolNumber}`,
    description: "a description",
    parameters: {
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

export const findToolDefinitionName = (toolDefinition: unknown) => {
  const parsed = llmProviderToolDefinitionSchema.safeParse(toolDefinition);
  if (!parsed.success || parsed.data === null || !isObject(parsed.data)) {
    return null;
  }

  // OpenAI format
  if (
    "function" in parsed.data &&
    isObject(parsed.data.function) &&
    "name" in parsed.data.function &&
    typeof parsed.data.function.name === "string"
  ) {
    return parsed.data.function.name;
  }

  // Anthropic format
  if ("name" in parsed.data && typeof parsed.data.name === "string") {
    return parsed.data.name;
  }

  // AWS format
  if (
    "toolSpec" in parsed.data &&
    isObject(parsed.data.toolSpec) &&
    "name" in parsed.data.toolSpec &&
    typeof parsed.data.toolSpec.name === "string"
  ) {
    return parsed.data.toolSpec.name;
  }

  // Gemini format - single function declaration
  if (
    "name" in parsed.data &&
    typeof parsed.data.name === "string" &&
    "parameters" in parsed.data
  ) {
    return parsed.data.name;
  }

  return null;
};

export const findToolDefinitionDescription = (toolDefinition: unknown) => {
  const parsed = llmProviderToolDefinitionSchema.safeParse(toolDefinition);
  if (!parsed.success || parsed.data === null || !isObject(parsed.data)) {
    return null;
  }

  // OpenAI format
  if (
    "function" in parsed.data &&
    isObject(parsed.data.function) &&
    "description" in parsed.data.function &&
    typeof parsed.data.function.description === "string"
  ) {
    return parsed.data.function.description;
  }

  // Anthropic format
  if (
    "description" in parsed.data &&
    typeof parsed.data.description === "string"
  ) {
    return parsed.data.description;
  }

  // AWS format
  if (
    "toolSpec" in parsed.data &&
    isObject(parsed.data.toolSpec) &&
    "description" in parsed.data.toolSpec &&
    typeof parsed.data.toolSpec.description === "string"
  ) {
    return parsed.data.toolSpec.description;
  }

  // Gemini format - single function declaration
  if (
    "description" in parsed.data &&
    typeof parsed.data.description === "string" &&
    "parameters" in parsed.data
  ) {
    return parsed.data.description;
  }

  return null;
};
