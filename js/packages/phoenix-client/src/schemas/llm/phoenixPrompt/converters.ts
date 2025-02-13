import { assertUnreachable } from "../../../utils/assertUnreachable";
import { OpenAIToolDefinition } from "../openai/toolSchemas";
import { OpenAIMessage } from "../openai/messageSchemas";
import { OpenAIToolCall } from "../openai/toolCallSchemas";
import { OpenaiToolChoice } from "../openai/toolChoiceSchemas";
import { phoenixMessageSchema } from "./messageSchemas";
import {
  ToolCallPart,
  ToolResultPart,
  asToolResultPart,
  phoenixContentPartSchema,
} from "./messagePartSchemas";
import { phoenixToolCallSchema } from "./toolCallSchemas";
import { safelyStringifyJSON } from "../../../utils/safelyStringifyJSON";
import { OpenAIChatPartText } from "../openai/messagePartSchemas";
import { phoenixResponseFormatSchema } from "./responseFormatSchema";
import { OpenAIResponseFormat } from "../openai/responseFormatSchema";
import { phoenixToolDefinitionSchema } from "./toolSchemas";
import { phoenixToolChoiceSchema } from "./toolChoiceSchemas";
import { jsonSchemaZodSchema } from "../../jsonSchema";
import { type } from "node:os";

/*
 * Conversion Functions
 *
 * These follow a hub-and-spoke model where OpenAI is the hub format.
 * All conversions between different formats go through OpenAI as an intermediate step.
 */

export const phoenixMessagePartToOpenAI = phoenixContentPartSchema.transform(
  (part) => {
    const type = part.type;
    switch (type) {
      case "text":
        return {
          type: "text",
          text: part.text,
        } satisfies OpenAIChatPartText;
      case "tool_call":
        return null;
      case "tool_result":
        return null;
      default:
        return assertUnreachable(type);
    }
  }
);

/**
 * Spoke → Hub: Convert a Prompt message to OpenAI format
 */
export const phoenixMessageToOpenAI = phoenixMessageSchema.transform(
  (prompt) => {
    const content =
      typeof prompt.content == "string"
        ? [{ type: "text", text: prompt.content }]
        : prompt.content;
    // Special handling for TOOL role messages
    if (prompt.role === "tool") {
      const toolResult = content
        .map((part) => asToolResultPart(part))
        .find((part): part is ToolResultPart => !!part);

      if (!toolResult) {
        throw new Error("TOOL role message must have a ToolResultContentPart");
      }

      return {
        role: "tool",
        content:
          typeof toolResult.tool_result === "string"
            ? toolResult.tool_result
            : safelyStringifyJSON(toolResult.tool_result).json || "",
        tool_call_id: toolResult.tool_call_id,
      } satisfies OpenAIMessage;
    }

    // Handle other roles
    const role = prompt.role;
    switch (role) {
      case "system":
      case "developer":
        return {
          role: "system",
          content: content
            .map((part) => phoenixMessagePartToOpenAI.parse(part))
            .filter(
              (part): part is OpenAIChatPartText =>
                part !== null && part.type === "text"
            ),
        } satisfies OpenAIMessage;
      case "user":
        return {
          role: "user",
          content: content
            .map((part) => phoenixMessagePartToOpenAI.parse(part))
            .filter(
              (part): part is OpenAIChatPartText =>
                part !== null && part.type === "text"
            ),
        } satisfies OpenAIMessage;
      case "assistant":
      case "ai":
      case "model":
        return {
          role: "assistant",
          content: content
            .map((part) => phoenixMessagePartToOpenAI.parse(part))
            .filter(
              (part): part is OpenAIChatPartText =>
                part !== null && part.type === "text"
            ),
          tool_calls: content.some((part) => part.type === "tool_call")
            ? content
                .filter(
                  (part): part is ToolCallPart => part.type === "tool_call"
                )
                .map((part) => phoenixToolCallToOpenAI.parse(part))
                .filter((part): part is OpenAIToolCall => part !== null)
            : undefined,
        } satisfies OpenAIMessage;
      default:
        return assertUnreachable(role);
    }
  }
);

export const phoenixResponseFormatToOpenAI =
  phoenixResponseFormatSchema.transform(
    (phoenix): OpenAIResponseFormat => ({
      type: "json_schema",
      json_schema: {
        name: phoenix.name,
        description: phoenix.description,
        schema: jsonSchemaZodSchema.parse(phoenix.schema.json),
      },
    })
  );

export const phoenixToolCallToOpenAI = phoenixToolCallSchema.transform(
  (prompt): OpenAIToolCall => ({
    type: "function",
    id: prompt.tool_call_id,
    function: {
      ...prompt.tool_call,
      arguments:
        typeof prompt.tool_call.arguments === "string"
          ? prompt.tool_call.arguments
          : (safelyStringifyJSON(prompt.tool_call.arguments).json ?? ""),
    },
  })
);

export const phoenixToolDefinitionToOpenAI =
  phoenixToolDefinitionSchema.transform(
    (phoenix): OpenAIToolDefinition => ({
      type: "function",
      function: {
        name: phoenix.name,
        description: phoenix.description,
        parameters: jsonSchemaZodSchema.parse(phoenix.schema?.json),
      },
    })
  );

export const phoenixToolChoiceToOpenAI = phoenixToolChoiceSchema.transform(
  (phoenix): OpenaiToolChoice => {
    switch (phoenix.type) {
      case "none":
        return "none";
      case "zero-or-more":
        return "auto";
      case "one-or-more":
        return "required";
      case "specific-function-tool":
        return { type: "function", function: { name: phoenix.function_name } };
    }
  }
);
