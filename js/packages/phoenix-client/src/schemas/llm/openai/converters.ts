import { assertUnreachable } from "../../../utils/assertUnreachable";
import { isObject } from "../../../utils/isObject";
import {
  AnthropicImageBlock,
  AnthropicMessagePart,
  AnthropicTextBlock,
  AnthropicToolUseBlock,
} from "../anthropic/messagePartSchemas";
import { AnthropicMessage } from "../anthropic/messageSchemas";
import { AnthropicToolCall } from "../anthropic/toolCallSchemas";
import { AnthropicToolChoice } from "../anthropic/toolChoiceSchemas";
import { AnthropicToolDefinition } from "../anthropic/toolSchemas";
import {
  makeTextPart,
  makeToolResultPart,
  PhoenixContentPart,
  ToolCallPart,
} from "../phoenixPrompt/messagePartSchemas";
import {
  PhoenixMessage,
  PhoenixMessageRole,
} from "../phoenixPrompt/messageSchemas";
import { VercelAIMessage } from "../vercel/messageSchemas";
import { VercelAIToolChoice } from "../vercel/toolChoiceSchemas";
import { VercelAIToolDefinition } from "../vercel/toolSchemas";

import { openaiChatPartSchema } from "./messagePartSchemas";
import { openAIMessageSchema } from "./messageSchemas";
import { openAIToolCallSchema } from "./toolCallSchemas";
import { openAIToolChoiceSchema } from "./toolChoiceSchemas";
import { openAIToolDefinitionSchema } from "./toolSchemas";

import invariant from "tiny-invariant";

export const openAIChatPartToAnthropic = openaiChatPartSchema.transform(
  (openai) => {
    const type = openai.type;
    switch (type) {
      case "text":
        return { type: "text", text: openai.text } satisfies AnthropicTextBlock;
      case "image_url": {
        if (!openai.image_url.url.startsWith("data:image/")) {
          return null;
        }
        let mediaType: "jpeg" | "png" | "gif" | "webp" | "jpg" =
          openai.image_url.url?.split(";")?.[0]?.split("/")[1] as
            | "jpeg"
            | "png"
            | "gif"
            | "webp"
            | "jpg";
        if (
          mediaType !== "jpeg" &&
          mediaType !== "jpg" &&
          mediaType !== "png" &&
          mediaType !== "gif" &&
          mediaType !== "webp"
        ) {
          return null;
        }
        if (mediaType === "jpg") {
          mediaType = "jpeg" as const;
        }
        return {
          type: "image",
          source: {
            data: openai.image_url.url,
            media_type: `image/${mediaType}`,
            type: "base64",
          },
        } satisfies AnthropicImageBlock;
      }
      default:
        return assertUnreachable(type);
    }
  }
);

/**
 * Hub → Spoke: Convert an OpenAI message to Anthropic format
 */
export const openAIMessageToAnthropic = openAIMessageSchema.transform(
  (openai): AnthropicMessage => {
    let role = openai.role;
    const content: AnthropicMessagePart[] = [];

    // convert all roles except assistant to user
    if (openai.role !== "assistant") {
      role = "user";
    }

    invariant(
      role === "user" || role === "assistant",
      `Unexpected openai role: ${role}`
    );
    if (typeof openai.content === "string" && openai.role !== "tool") {
      content.push({ type: "text", text: openai.content });
    } else if (Array.isArray(openai.content)) {
      openai.content.forEach((part) => {
        if (part.type === "text" || part.type === "image_url") {
          const parsedPart = openAIChatPartToAnthropic.parse(part);
          if (parsedPart) {
            content.push(parsedPart);
          }
        }
      });
    }

    let toolCallParts: AnthropicToolUseBlock[] = [];
    if (openai.role === "assistant" && "tool_calls" in openai) {
      toolCallParts =
        openai.tool_calls?.map((tc) => openAIToolCallToAnthropic.parse(tc)) ??
        [];
    }
    if (toolCallParts.length > 0) {
      toolCallParts.forEach((tc) => {
        content.push(tc);
      });
    }

    if (openai.role === "tool") {
      content.push({
        type: "tool_result",
        tool_use_id: openai.tool_call_id,
        content: openai.content,
      });
    }

    return {
      role,
      content,
    };
  }
);

/**
 * Hub → Spoke: Convert an OpenAI message to Prompt format
 */
export const openAIMessageToPhoenixPrompt = openAIMessageSchema.transform(
  (openai): PhoenixMessage => {
    const content: PhoenixContentPart[] = [];

    // Special handling for tool messages
    if (openai.role === "tool" && openai.tool_call_id) {
      const toolResultPart = makeToolResultPart(
        openai.tool_call_id,
        openai.content
      );
      if (toolResultPart) {
        content.push(toolResultPart);
      }
      return {
        role: "tool",
        content,
      };
    }

    // Convert content to text part if it exists
    if (typeof openai.content === "string") {
      const textPart = makeTextPart(openai.content);
      if (textPart) {
        content.push(textPart);
      }
    } else if (Array.isArray(openai.content)) {
      openai.content.forEach((part) => {
        if (part.type === "text") {
          const textPart = makeTextPart(part.text);
          if (textPart) {
            content.push(textPart);
          }
        }
      });
    }

    // Convert tool calls if they exist
    if (openai.role === "assistant" && openai.tool_calls) {
      openai.tool_calls.forEach((tc) => {
        const toolCallPart = {
          type: "tool_call",
          tool_call_id: tc.id,
          tool_call: {
            type: "function",
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        } satisfies ToolCallPart;
        if (toolCallPart) {
          content.push(toolCallPart);
        }
      });
    }

    // Map roles
    const roleMap = {
      system: "SYSTEM",
      user: "USER",
      assistant: "AI",
      tool: "TOOL",
      developer: "SYSTEM", // Map developer to SYSTEM
      function: "TOOL", // Map function to TOOL
    } as const;

    return {
      role: roleMap[openai.role] as PhoenixMessageRole,
      content,
    };
  }
);

/**
 * Spoke → Hub: Convert a Prompt message to AI format
 */
export const openAIMessageToVercelAI = openAIMessageSchema.transform(
  (openai): VercelAIMessage => {
    const role = openai.role;
    switch (role) {
      case "developer":
      case "system":
        // take the first text part, or use string content if it exists
        return {
          role: "system",
          content:
            typeof openai.content === "string"
              ? openai.content
              : (openai.content.find((part) => part.type === "text")?.text ??
                ""),
        };
      case "user":
        // take text and image parts, ignore other parts
        return {
          role: "user",
          content:
            typeof openai.content === "string"
              ? openai.content
              : openai.content
                  .filter(
                    (part) => part.type === "text" || part.type === "image_url"
                  )
                  .map((part) => {
                    if (part.type === "text") {
                      return {
                        type: "text",
                        text: part.text,
                      };
                    }
                    if (part.type === "image_url") {
                      return {
                        type: "image",
                        image: part.image_url.url,
                      };
                    }

                    return assertUnreachable(part);
                  }),
        };
      case "assistant": {
        type AssistantMessage = Extract<VercelAIMessage, { role: "assistant" }>;
        // take text any parts, convert tool calls to tool call parts, ignore other parts
        const newContent: AssistantMessage["content"] = [];
        // take all text parts from openai message
        if (typeof openai.content === "string") {
          newContent.push({ type: "text", text: openai.content });
        } else {
          openai.content.forEach((part) => {
            if (part.type === "text") {
              newContent.push({ type: "text", text: part.text });
            }
          });
        }
        // add any tool calls
        if (openai.tool_calls) {
          openai.tool_calls.forEach((tc) => {
            newContent.push({
              type: "tool-call",
              toolCallId: tc.id,
              toolName: tc.function.name,
              input: tc.function.arguments,
            });
          });
        }
        return {
          role: "assistant",
          content: newContent,
        };
      }
      case "tool": {
        type ToolMessage = Extract<VercelAIMessage, { role: "tool" }>;
        const newContent: ToolMessage["content"] = [];
        if (typeof openai.content === "string") {
          newContent.push({
            type: "tool-result",
            toolCallId: openai.tool_call_id,
            toolName: "", // We don't have this??
            output: { type: "text", value: openai.content },
          });
        } else {
          openai.content.forEach((part) => {
            if (part.type === "text") {
              newContent.push({
                type: "tool-result",
                toolCallId: openai.tool_call_id,
                toolName: "", // We don't have this??
                output: {
                  type: "text",
                  value: part.text,
                },
              });
              return;
            }
            assertUnreachable(part.type);
          });
        }
        return {
          role: "tool",
          content: newContent,
        } satisfies ToolMessage;
      }
      case "function":
        // eslint-disable-next-line no-console
        console.warn("Function role not supported in Vercel AI SDK");
        return {
          role: "tool",
          content: [],
        };
      default:
        assertUnreachable(role);
    }
  }
);

/**
 * Parse incoming object as an OpenAI tool call and immediately convert to Anthropic format
 */
export const openAIToolCallToAnthropic = openAIToolCallSchema.transform(
  (openai): AnthropicToolCall => ({
    id: openai.id,
    type: "tool_use",
    name: openai.function.name,
    input: openai.function.arguments,
  })
);

export const openAIToolChoiceToAnthropic = openAIToolChoiceSchema.transform(
  (openAI): AnthropicToolChoice => {
    if (isObject(openAI)) {
      return { type: "tool", name: openAI.function.name };
    }
    switch (openAI) {
      case "auto":
        return { type: "auto" };
      case "none":
        return { type: "auto" };
      case "required":
        return { type: "any" };
      default:
        assertUnreachable(openAI);
    }
  }
);

export const openAIToolChoiceToVercelAI = openAIToolChoiceSchema.transform(
  (openAI): VercelAIToolChoice => {
    if (isObject(openAI)) {
      return { type: "tool", toolName: openAI.function.name };
    }
    switch (openAI) {
      case "auto":
        return "auto";
      case "none":
        return "none";
      case "required":
        return "required";
      default:
        assertUnreachable(openAI);
    }
  }
);

/**
 * Parse incoming object as an OpenAI tool call and immediately convert to Anthropic format
 */
export const openAIToolDefinitionToAnthropic =
  openAIToolDefinitionSchema.transform(
    (openai): AnthropicToolDefinition => ({
      name: openai.function.name,
      description: openai.function.description ?? openai.function.name,
      input_schema: openai.function.parameters,
    })
  );

/**
 * Parse incoming object as an OpenAI tool definition and immediately convert to Vercel AI format
 */
export const openAIToolDefinitionToVercelAI =
  openAIToolDefinitionSchema.transform(
    (openai): VercelAIToolDefinition => ({
      type: "function",
      description: openai.function.description,
      inputSchema: {
        _type: undefined,
        jsonSchema: openai.function.parameters,
        validate: undefined,
      },
    })
  );
