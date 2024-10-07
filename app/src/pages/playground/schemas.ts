import { z } from "zod";

import {
  ImageAttributesPostfixes,
  MessageAttributePostfixes,
  MessageContentsAttributePostfixes,
  SemanticAttributePrefixes,
  SemanticConventions,
} from "@arizeai/openinference-semantic-conventions";

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
 * The zod schema for llm message contents
 * @see {@link https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md|Semantic Conventions}
 */
const messageContentSchema = z.object({
  [SemanticAttributePrefixes.message_content]: z
    .object({
      [MessageContentsAttributePostfixes.type]: z.string(),
      [MessageContentsAttributePostfixes.text]: z.string(),
      [MessageContentsAttributePostfixes.image]: z
        .object({
          [MessageContentsAttributePostfixes.image]: z
            .object({
              [ImageAttributesPostfixes.url]: z.string(),
            })
            .partial(),
        })
        .partial(),
    })
    .partial(),
});
/**
 * The zod schema for llm messages
 * @see {@link https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md|Semantic Conventions}
 */
const messageSchema = z.object({
  [MessageAttributePostfixes.role]: z.string(),
  [MessageAttributePostfixes.content]: z.string(),
  [MessageAttributePostfixes.name]: z.string().optional(),
  [MessageAttributePostfixes.tool_calls]: z.array(toolCallSchema).optional(),
  [MessageAttributePostfixes.contents]: z
    .array(messageContentSchema)
    .optional(),
});

/**
 * The zod schema for llm attributes
 * @see {@link https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md|Semantic Conventions}
 */
export const llmAttributesSchema = z.object({
  [SemanticConventions.LLM_INPUT_MESSAGES]: z.array(messageSchema),
  [SemanticConventions.LLM_OUTPUT_MESSAGES]: z.optional(z.array(messageSchema)),
});
