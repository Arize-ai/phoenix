import { z } from "zod";

import {
  LLMAttributePostfixes,
  MessageAttributePostfixes,
  SemanticAttributePrefixes,
} from "@arizeai/openinference-semantic-conventions";

import { ChatMessage } from "@phoenix/store";
import { Mutable, schemaForType } from "@phoenix/typeUtils";

import { InvocationParameterInput } from "./__generated__/PlaygroundOutputSubscription.graphql";

/**
 * The zod schema for llm tool calls in an input message
 * @see {@link https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md|Semantic Conventions}
 */
const toolCallSchema = z
  .object({
    function: z
      .object({
        name: z.string(),
        arguments: z.string(),
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
    [MessageAttributePostfixes.content]: z.string(),
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
    content: z.string(),
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
  Mutable<InvocationParameterInput>
>()(
  z.object({
    invocationName: z.string(),
    valueBool: z.boolean().optional(),
    valueFloat: z.number().optional(),
    valueInt: z.number().optional(),
    valueJson: z.any().optional(),
    valueString: z.string().optional(),
    valueStringList: z.array(z.string()).optional(),
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
    let json;
    try {
      json = JSON.parse(s);
    } catch (e) {
      return {};
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
        .transform(invocationParameterSchema.parse)
        .parse(json)
    );
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

// /**
//  * Default set of invocation parameters for all providers and models.
//  */
// const baseInvocationParameterSchema = invocationParameterSchema.omit({
//   maxCompletionTokens: true,
// });

// /**
//  * Invocation parameters for O1 models.
//  */
// const o1BaseInvocationParameterSchema = invocationParameterSchema.pick({
//   maxCompletionTokens: true,
// });

// /**
//  * Provider schemas for all models and optionally for a specific model.
//  */
// export const providerSchemas = {
//   OPENAI: {
//     default: baseInvocationParameterSchema,
//     "o1-preview": o1BaseInvocationParameterSchema,
//     "o1-preview-2024-09-12": o1BaseInvocationParameterSchema,
//     "o1-mini": o1BaseInvocationParameterSchema,
//     "o1-mini-2024-09-12": o1BaseInvocationParameterSchema,
//   },
//   AZURE_OPENAI: {
//     default: baseInvocationParameterSchema,
//   },
//   ANTHROPIC: {
//     default: baseInvocationParameterSchema,
//   },
// } satisfies Record<
//   ModelProvider,
//   Record<string, z.ZodType<InvocationParametersSchema>>
// >;
