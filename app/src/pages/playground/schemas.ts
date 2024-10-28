import { z } from "zod";

import {
  LLMAttributePostfixes,
  MessageAttributePostfixes,
  SemanticAttributePrefixes,
  ToolAttributePostfixes,
} from "@arizeai/openinference-semantic-conventions";

import { openAIToolCallSchema, openAIToolSchema } from "@phoenix/schemas";
import { ChatMessage } from "@phoenix/store";
import { isObject, Mutable, schemaForType } from "@phoenix/typeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { InvocationParameters } from "./__generated__/PlaygroundOutputSubscription.graphql";

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
    [MessageAttributePostfixes.content]: z.string().optional(),
    [MessageAttributePostfixes.tool_calls]: z.array(toolCallSchema).optional(),
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

const chatMessageSchema = schemaForType<ChatMessage>()(
  z.object({
    id: z.number(),
    role: chatMessageRolesSchema,
    // Tool call messages may not have content
    content: z.string().optional(),
    toolCallId: z.string().optional(),
    toolCalls: z.array(openAIToolCallSchema).optional(),
  })
);

/**
 * The zod schema for ChatMessages
 */
export const chatMessagesSchema = z.array(chatMessageSchema);

/**
 * Model graphql invocation parameters schema in zod.
 *
 * Includes all keys besides toolChoice
 */
const invocationParameterSchema = schemaForType<
  Mutable<InvocationParameters>
>()(
  z.object({
    temperature: z.coerce.number().optional(),
    topP: z.coerce.number().optional(),
    maxTokens: z.coerce.number().optional(),
    stop: z.array(z.string()).optional(),
    seed: z.coerce.number().optional(),
    maxCompletionTokens: z.coerce.number().optional(),
  })
);

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
  .transform((s) => {
    const { json } = safelyParseJSON(s);
    if (!isObject(json)) {
      return null;
    }
    // using the invocationParameterSchema as a base,
    // apply all matching keys from the input string,
    // and then map snake cased keys to camel case on top
    return (
      invocationParameterSchema
        .passthrough()
        .transform((o) => ({
          ...o,
          // map snake cased keys to camel case, the first char after each _ is uppercase
          ...Object.fromEntries(
            Object.entries(o).map(([k, v]) => [
              k.replace(/_([a-z])/g, (_, char) => char.toUpperCase()),
              v,
            ])
          ),
        }))
        // reparse the object to ensure the mapped keys are also validated
        .parse(json)
    );
  })
  .transform((v, ctx) => {
    const result = invocationParameterSchema.safeParse(v);
    if (!result.success) {
      // bubble errors up to the original schema
      result.error.issues.forEach((issue) => {
        ctx.addIssue(issue);
      });
      // https://zod.dev/?id=validating-during-transform
      // ensures that this schema still infers the "success" type
      // errors will throw instead
      return z.NEVER;
    }
    return result.data;
  })
  .default("{}");
/**
 * The zod schema for llm model config
 * @see {@link https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md|Semantic Conventions}
 */
export const modelConfigSchema = z.object({
  [SemanticAttributePrefixes.llm]: z.object({
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
  // TODO(parker / apowell) - adjust this transformation with anthropic tool support https://github.com/Arize-ai/phoenix/issues/5100
  .transform((o, ctx) => {
    const { data, success } = openAIToolSchema.safeParse(o);

    if (!success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The tool JSON schema must be a valid OpenAI tool schema",
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

/**
 * Default set of invocation parameters for all providers and models.
 */
const baseInvocationParameterSchema = invocationParameterSchema.omit({
  maxCompletionTokens: true,
});

/**
 * Invocation parameters for O1 models.
 */
const o1BaseInvocationParameterSchema = invocationParameterSchema.pick({
  maxCompletionTokens: true,
});

/**
 * Provider schemas for all models and optionally for a specific model.
 */
export const providerSchemas = {
  OPENAI: {
    default: baseInvocationParameterSchema,
    "o1-preview": o1BaseInvocationParameterSchema,
    "o1-preview-2024-09-12": o1BaseInvocationParameterSchema,
    "o1-mini": o1BaseInvocationParameterSchema,
    "o1-mini-2024-09-12": o1BaseInvocationParameterSchema,
  },
  AZURE_OPENAI: {
    default: baseInvocationParameterSchema,
  },
  ANTHROPIC: {
    default: baseInvocationParameterSchema,
  },
} satisfies Record<
  ModelProvider,
  Record<string, z.ZodType<InvocationParametersSchema>>
>;
