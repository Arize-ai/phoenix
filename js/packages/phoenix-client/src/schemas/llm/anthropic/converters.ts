import { assertUnreachable } from "../../../utils/assertUnreachable";
import { safelyStringifyJSON } from "../../../utils/safelyStringifyJSON";
import {
  OpenAIChatPart,
  OpenAIChatPartImage,
  OpenAIChatPartText,
} from "../openai/messagePartSchemas";
import {
  OpenAIMessage,
  openAIMessageRoleSchema,
} from "../openai/messageSchemas";
import { OpenAIToolCall } from "../openai/toolCallSchemas";
import { OpenaiToolChoice } from "../openai/toolChoiceSchemas";
import { OpenAIToolDefinition } from "../openai/toolSchemas";

import {
  AnthropicMessagePart,
  anthropicMessagePartSchema,
  AnthropicToolUseBlock,
} from "./messagePartSchemas";
import { anthropicMessageSchema } from "./messageSchemas";
import { anthropicToolCallSchema } from "./toolCallSchemas";
import { anthropicToolChoiceSchema } from "./toolChoiceSchemas";
import { anthropicToolDefinitionSchema } from "./toolSchemas";

import invariant from "tiny-invariant";

/*
 * Conversion Functions
 *
 * These follow a hub-and-spoke model where OpenAI is the hub format.
 * All conversions between different formats go through OpenAI as an intermediate step.
 */

export const anthropicMessagePartToOpenAI =
  anthropicMessagePartSchema.transform((anthropic): OpenAIChatPart | null => {
    const type = anthropic.type;
    switch (type) {
      case "text":
        return {
          type: "text",
          text: anthropic.text,
        } satisfies OpenAIChatPartText;
      case "image":
        return {
          type: "image_url",
          image_url: { url: anthropic.source.data },
        } satisfies OpenAIChatPartImage;
      case "tool_use":
        return null;
      case "tool_result":
        return null;
      default:
        return assertUnreachable(type);
    }
  });

/**
 * Spoke → Hub: Convert an Anthropic message to OpenAI format
 */
export const anthropicMessageToOpenAI = anthropicMessageSchema.transform(
  (anthropic): OpenAIMessage => {
    let role = openAIMessageRoleSchema.parse(anthropic.role);

    if (
      Array.isArray(anthropic.content) &&
      anthropic.content.some((part) => part.type === "tool_result")
    ) {
      role = "tool";
    }

    const initialContentArray: AnthropicMessagePart[] =
      typeof anthropic.content === "string"
        ? [{ type: "text", text: anthropic.content }]
        : anthropic.content;
    const toolCallParts = initialContentArray.filter(
      (part): part is AnthropicToolUseBlock => part.type === "tool_use"
    );
    const nonToolCallParts = initialContentArray.filter(
      (part) => part.type !== "tool_use"
    );

    invariant(
      role === "user" || role === "assistant",
      `Unexpected anthropic role: ${role}`
    );

    switch (role) {
      case "assistant": {
        const content = nonToolCallParts
          .map((part) => anthropicMessagePartToOpenAI.parse(part))
          .filter(
            (part): part is OpenAIChatPartText =>
              part !== null && part.type === "text"
          );
        return {
          role: "assistant",
          tool_calls:
            toolCallParts.length > 0
              ? toolCallParts.map((tc) => anthropicToolCallToOpenAI.parse(tc))
              : undefined,
          content,
        };
      }
      case "user": {
        const content = nonToolCallParts
          .map((part) => anthropicMessagePartToOpenAI.parse(part))
          .filter((part): part is OpenAIChatPart => part !== null);
        return {
          role: "user",
          content,
        };
      }
      default:
        return assertUnreachable(role);
    }
  }
);

/**
 * Parse incoming object as an Anthropic tool call and immediately convert to OpenAI format
 */
export const anthropicToolCallToOpenAI = anthropicToolCallSchema.transform(
  (anthropic): OpenAIToolCall => ({
    type: "function",
    id: anthropic.id,
    function: {
      name: anthropic.name,
      arguments:
        typeof anthropic.input === "string"
          ? anthropic.input
          : (safelyStringifyJSON(anthropic.input).json ?? ""),
    },
  })
);

/**
 * Parse incoming object as an Anthropic tool choice and immediately convert to OpenAI format
 */
export const anthropicToolChoiceToOpenAI = anthropicToolChoiceSchema.transform(
  (anthropic): OpenaiToolChoice => {
    switch (anthropic.type) {
      case "any":
        return "required";
      case "auto":
        return "auto";
      case "tool":
        if (!anthropic.name) {
          return "auto";
        }
        return {
          type: "function",
          function: { name: anthropic.name },
        };
      default:
        return "auto";
    }
  }
);

/**
 * Parse incoming object as an Anthropic tool call and immediately convert to OpenAI format
 */
export const anthropicToolDefinitionToOpenAI =
  anthropicToolDefinitionSchema.transform(
    (anthropic): OpenAIToolDefinition => ({
      type: "function",
      function: {
        name: anthropic.name,
        description: anthropic.description,
        parameters: anthropic.input_schema,
      },
    })
  );
