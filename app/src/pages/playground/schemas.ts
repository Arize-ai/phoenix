import { z } from "zod";

import {
  LLMAttributePostfixes,
  MessageAttributePostfixes,
  SemanticAttributePrefixes,
} from "@arizeai/openinference-semantic-conventions";

import { ChatMessage } from "@phoenix/store";
import { schemaForType } from "@phoenix/typeUtils";

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
 * The zod schema for llm model config
 * @see {@link https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md|Semantic Conventions}
 */
export const modelConfigSchema = z.object({
  [SemanticAttributePrefixes.llm]: z.object({
    [LLMAttributePostfixes.model_name]: z.string(),
    [LLMAttributePostfixes.invocation_parameters]: z
      .string()
      .transform((s) =>
        z
          // TODO(apowell): specify schema for parameters that we care about
          // convert them to camelCase after parsing so that we don't have to convert
          // before hitting zustand
          .object({})
          .parse(JSON.parse(s))
      )
      .default("{}"),
  }),
});
