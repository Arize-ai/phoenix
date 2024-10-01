import { z } from "zod";

import {
  ImageAttributesPostfixes,
  LLMAttributePostfixes,
  MessageAttributePostfixes,
  MessageContentsAttributePostfixes,
  SemanticAttributePrefixes,
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
const messageSchema = z
  .object({
    [MessageAttributePostfixes.role]: z.string(),
    [MessageAttributePostfixes.content]: z.string(),
    [MessageAttributePostfixes.name]: z.string(),
    [MessageAttributePostfixes.tool_calls]: z.array(toolCallSchema),
    [MessageAttributePostfixes.contents]: z.array(messageContentSchema),
  })
  .partial();

const llmAttributesSchema = z
  .object({
    [LLMAttributePostfixes.model_name]: z.string(),
    [LLMAttributePostfixes.prompts]: z.array(z.string()),
    prompt_template: z
      .object({
        template: z.string(),
        variables: z.record(z.string()),
      })
      .partial(),
  })
  .partial();
