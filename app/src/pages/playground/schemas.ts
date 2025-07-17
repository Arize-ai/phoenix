import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import {
  LLMAttributePostfixes,
  MessageAttributePostfixes,
  SemanticAttributePrefixes,
  ToolAttributePostfixes,
} from "@arizeai/openinference-semantic-conventions";

import {
  jsonSchemaZodSchema,
  llmProviderToolDefinitionSchema,
} from "@phoenix/schemas";
import {
  JSONLiteral,
  jsonLiteralSchema,
} from "@phoenix/schemas/jsonLiteralSchema";
import { llmProviderToolCallSchema } from "@phoenix/schemas/toolCallSchemas";
import {
  isObject,
  isStringKeyedObject,
  schemaForType,
} from "@phoenix/typeUtils";
import { safelyParseJSON, safelyStringifyJSON } from "@phoenix/utils/jsonUtils";

/**
 * The zod schema for llm tool calls in an input message
 * @see {@link https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md|Semantic Conventions}
 */
const toolCallSchema = z
  .object({
    tool_call: z
      .object({
        id: z.string().optional(),
        function: z
          .object({
            name: z.string(),
            arguments: z.string(),
          })
          .partial(),
      })
      .partial(),
  })
  .partial();

/**
 * The zod schema for llm messages
 * @see {@link https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md|Semantic Conventions}
 */
const messageSchema = z.object({
  [SemanticAttributePrefixes.message]: z.object({
    [MessageAttributePostfixes.role]: z.string(),
    [MessageAttributePostfixes.content]: z
      .union([z.string(), z.array(z.record(z.string(), z.unknown()))])
      .default(""),
    [MessageAttributePostfixes.contents]: z
      .array(z.object({ message_content: z.record(z.string()) }))
      .optional(),
    [MessageAttributePostfixes.tool_calls]: z.array(toolCallSchema).optional(),
    [MessageAttributePostfixes.tool_call_id]: z.string().optional(),
  }),
});

/**
 * The type of each message in either the input or output messages
 * on a spans attributes
 */
export type MessageSchema = z.infer<typeof messageSchema>;

/**
 * The zod schema for llm.input_messages attributes
 * @see {@link https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md|Semantic Conventions}
 */
export const llmInputMessageSchema = z.object({
  [SemanticAttributePrefixes.llm]: z.object({
    [LLMAttributePostfixes.input_messages]: z.array(messageSchema),
  }),
});

/**
 * The zod schema for llm.output_messages attributes
 * @see {@link https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md|Semantic Conventions}
 */
export const llmOutputMessageSchema = z.object({
  [SemanticAttributePrefixes.llm]: z.object({
    [LLMAttributePostfixes.output_messages]: z.array(messageSchema),
  }),
});

/**
 * The zod schema for output attributes
 * @see {@link https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md|Semantic Conventions}
 */
export const outputSchema = z.object({
  [SemanticAttributePrefixes.output]: z.object({
    value: z.string(),
  }),
});

/**
 * The zod schema for {@link chatMessageRoles}
 */
export const chatMessageRolesSchema = schemaForType<ChatMessageRole>()(
  z.enum(["user", "ai", "system", "tool"])
);

export const chatMessageSchema = z.object({
  id: z.number(),
  role: chatMessageRolesSchema,
  // Tool call messages may not have content
  content: z.string().optional(),
  toolCallId: z.string().optional(),
  toolCalls: z.array(llmProviderToolCallSchema).optional(),
});

/**
 * The zod schema for ChatMessages
 */
export const chatMessagesSchema = z.array(chatMessageSchema);

export const jsonObjectSchema: z.ZodType<{ [key: string]: JSONLiteral }> =
  z.lazy(() => z.record(jsonLiteralSchema));

export type JsonObjectSchema = z.infer<typeof jsonObjectSchema>;

/**
 * Model generic invocation parameters schema in zod.
 */
const invocationParameterSchema = jsonObjectSchema;

/**
 * The type of the invocation parameters schema
 */
export type InvocationParametersSchema = z.infer<
  typeof invocationParameterSchema
>;

/**
 * Transform a string to an invocation parameters schema.
 *
 * If the string is not valid JSON, return an empty object.
 * If the string is valid JSON, but does not match the invocation parameters schema,
 * map the snake cased keys to camel case and return the result.
 */
const stringToInvocationParametersSchema = z
  .string()
  .transform((s, ctx) => {
    const { json } = safelyParseJSON(s);
    if (!isObject(json)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The invocation parameters must be a valid JSON object",
      });
      return z.NEVER;
    }

    const { success, data } = invocationParameterSchema.safeParse(json);
    if (!success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The invocation parameters must be a valid JSON object",
      });
      return z.NEVER;
    }
    return data;
  })
  .default("{}");
/**
 * The zod schema for llm model config
 * @see {@link https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md|Semantic Conventions}
 */
export const modelConfigSchema = z.object({
  [SemanticAttributePrefixes.llm]: z.object({
    [LLMAttributePostfixes.provider]: z.string().optional(),
    [LLMAttributePostfixes.model_name]: z.string(),
  }),
});

/**
 * The zod schema for llm.invocation_parameters attributes
 * @see {@link https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md|Semantic Conventions}
 */
export const modelConfigWithInvocationParametersSchema = z.object({
  [SemanticAttributePrefixes.llm]: z.object({
    [LLMAttributePostfixes.invocation_parameters]:
      stringToInvocationParametersSchema,
  }),
});

export const modelConfigWithResponseFormatSchema = z.object({
  [SemanticAttributePrefixes.llm]: z.object({
    [LLMAttributePostfixes.invocation_parameters]:
      stringToInvocationParametersSchema.pipe(
        z.object({
          response_format: jsonObjectSchema.optional(),
        })
      ),
  }),
});

export const urlSchema = z.object({
  url: z.object({
    full: z.string(),
    path: z.string().optional(),
  }),
});

/**
 *  The zod schema for llm.tools.{i}.tool.json_schema attribute
 *  This will be a json string parsed into an object
 */
export const toolJSONSchemaSchema = z
  .string()
  .transform((s, ctx) => {
    const { json } = safelyParseJSON(s);

    if (json == null || !isObject(json)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The tool JSON schema must be a valid JSON object",
      });
      return z.NEVER;
    }
    return json;
  })
  .transform((o, ctx) => {
    const { data, success } = llmProviderToolDefinitionSchema.safeParse(o);

    if (!success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The tool JSON schema must be a valid tool schema",
      });
      return z.NEVER;
    }
    return data;
  });

/**
 * The zod schema for llm.tools
 * @see {@link  https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md|Semantic Conventions}
 * Note there are other attributes that can be on llm.tools.{i}.tool, namely description, name, and parameters
 * however, these are encompassed by the json schema in some cases and calls to api's using destructured tools is not supported in the playground yet
 */
export const llmToolSchema = z
  .object({
    [SemanticAttributePrefixes.llm]: z
      .object({
        [LLMAttributePostfixes.tools]: z
          .array(
            z
              .object({
                [SemanticAttributePrefixes.tool]: z.object({
                  [ToolAttributePostfixes.json_schema]: toolJSONSchemaSchema,
                }),
              })
              .optional()
          )
          .optional(),
      })
      .optional(),
  })
  .optional();

export type LlmToolSchema = z.infer<typeof llmToolSchema>;

export const openAIResponseFormatSchema = z.lazy(() =>
  z.object({
    type: z.literal("json_schema"),
    json_schema: z.object({
      name: z.string().describe("The name of the schema"),
      schema: jsonSchemaZodSchema.describe(
        "The schema itself in JSON schema format"
      ),
      strict: z.literal(true).describe("The schema must be strict"),
    }),
  })
);

export type OpenAIResponseFormat = z.infer<typeof openAIResponseFormatSchema>;

export const openAIResponseFormatJSONSchema = zodToJsonSchema(
  openAIResponseFormatSchema,
  {
    removeAdditionalStrategy: "passthrough",
  }
);

const promptTemplateVariablesSchema = z.string().transform((s, ctx) => {
  const { json } = safelyParseJSON(s);
  if (!isStringKeyedObject(json)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "The prompt template variables must be a valid JSON object",
    });
    return z.NEVER;
  }
  const parsedVariables = Object.entries(json).reduce(
    (acc, [key, value]) => {
      if (typeof value === "string") {
        acc[key] = value;
      } else {
        const { json } = safelyStringifyJSON(value);
        if (json != null) {
          acc[key] = json;
        }
      }
      return acc;
    },
    {} as Record<string, string | undefined>
  );
  return parsedVariables;
});

export const promptTemplateSchema = z
  .object({
    [SemanticAttributePrefixes.llm]: z
      .object({
        [LLMAttributePostfixes.prompt_template]: z
          .object({
            variables: promptTemplateVariablesSchema,
          })
          .optional(),
      })
      .optional(),
  })
  .optional();
