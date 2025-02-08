import { assertUnreachable } from "../../../utils/assertUnreachable";
import {
  OpenAIMessage,
  OpenAIToolCall,
  OpenAIToolDefinition,
  OpenaiToolChoice,
} from "../openai";
import { promptMessageSchema } from "./messageSchemas";
import {
  ToolCallPart,
  ToolResultPart,
  asToolResultPart,
  promptPartSchema,
} from "./messagePartSchemas";
import { promptToolCallSchema } from "./toolCallSchemas";
import { safelyStringifyJSON } from "../../../utils/safelyStringifyJSON";
import {
  OpenAIChatPartImage,
  OpenAIChatPartText,
} from "../openai/messagePartSchemas";
import { phoenixResponseFormatSchema } from "./responseFormatSchema";
import { OpenAIResponseFormat } from "../openai/responseFormatSchema";
import { phoenixToolDefinitionSchema } from "./toolSchemas";
import { phoenixToolChoiceSchema } from "./toolChoiceSchemas";

/*
 * Conversion Functions
 *
 * These follow a hub-and-spoke model where OpenAI is the hub format.
 * All conversions between different formats go through OpenAI as an intermediate step.
 */

export const promptMessagePartToOpenAIChatPart = promptPartSchema.transform(
  (part) => {
    const type = part.type;
    switch (type) {
      case "text":
        return {
          type: "text",
          text: part.text.text,
        } satisfies OpenAIChatPartText;
      case "tool_call":
        return null;
      case "tool_result":
        return null;
      case "image":
        return {
          type: "image_url",
          image_url: { url: part.image.url },
        } satisfies OpenAIChatPartImage;
      default:
        return assertUnreachable(type);
    }
  }
);

/**
 * Spoke → Hub: Convert a Prompt message to OpenAI format
 */
export const promptMessageToOpenAI = promptMessageSchema.transform((prompt) => {
  // Special handling for TOOL role messages
  if (prompt.role === "TOOL") {
    const toolResult = prompt.content
      .map((part) => asToolResultPart(part))
      .find((part): part is ToolResultPart => !!part);

    if (!toolResult) {
      throw new Error("TOOL role message must have a ToolResultContentPart");
    }

    return {
      role: "tool",
      content:
        typeof toolResult.tool_result.result === "string"
          ? toolResult.tool_result.result
          : safelyStringifyJSON(toolResult.tool_result.result).json || "",
      tool_call_id: toolResult.tool_result.tool_call_id,
    } satisfies OpenAIMessage;
  }

  // Handle other roles
  const role = prompt.role;
  switch (role) {
    case "SYSTEM":
      return {
        role: "system",
        content: prompt.content
          .map((part) => promptMessagePartToOpenAIChatPart.parse(part))
          .filter(
            (part): part is OpenAIChatPartText =>
              part !== null && part.type === "text"
          ),
      } satisfies OpenAIMessage;
    case "USER":
      return {
        role: "user",
        content: prompt.content
          .map((part) => promptMessagePartToOpenAIChatPart.parse(part))
          .filter(
            (part): part is OpenAIChatPartText | OpenAIChatPartImage =>
              part !== null &&
              (part.type === "text" || part.type === "image_url")
          ),
      } satisfies OpenAIMessage;
    case "AI":
      return {
        role: "assistant",
        content: prompt.content
          .map((part) => promptMessagePartToOpenAIChatPart.parse(part))
          .filter(
            (part): part is OpenAIChatPartText =>
              part !== null && part.type === "text"
          ),
        tool_calls: prompt.content.some((part) => part.type === "tool_call")
          ? prompt.content
              .filter((part): part is ToolCallPart => part.type === "tool_call")
              .map((part) => promptToOpenAIToolCall.parse(part))
              .filter((part): part is OpenAIToolCall => part !== null)
          : undefined,
      } satisfies OpenAIMessage;
    default:
      return assertUnreachable(role);
  }
});

export const phoenixResponseFormatToOpenAI =
  phoenixResponseFormatSchema.transform(
    (phoenix): OpenAIResponseFormat => ({
      type: "json_schema",
      json_schema: {
        name: phoenix.name,
        description: phoenix.description,
        schema: phoenix.schema.json,
      },
    })
  );

export const promptToOpenAIToolCall = promptToolCallSchema.transform(
  (prompt): OpenAIToolCall => ({
    type: "function",
    id: prompt.tool_call.tool_call_id,
    function: {
      ...prompt.tool_call.tool_call,
      arguments:
        typeof prompt.tool_call.tool_call.arguments === "string"
          ? prompt.tool_call.tool_call.arguments
          : (safelyStringifyJSON(prompt.tool_call.tool_call.arguments).json ??
            ""),
    },
  })
);

export const phoenixToolToOpenAI = phoenixToolDefinitionSchema.transform(
  (phoenix): OpenAIToolDefinition => ({
    type: "function",
    function: {
      name: phoenix.name,
      description: phoenix.description,
      parameters: phoenix.schema.json,
    },
  })
);

export const phoenixToolChoiceToOpenaiToolChoice =
  phoenixToolChoiceSchema.transform((phoenix): OpenaiToolChoice => {
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
  });
