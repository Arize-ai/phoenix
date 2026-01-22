import type { Response } from "express";
import type {
  MessageCreateParams,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  Tool,
} from "@anthropic-ai/sdk/resources/messages";
import type { ServerConfig } from "../types.js";

// Simplified Message type for mock server (SDK type has strict required fields)
interface MockMessage {
  id: string;
  type: "message";
  role: "assistant";
  content: ContentBlock[];
  model: string;
  stop_reason: StopReason | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
import {
  generateAnthropicMessageId,
  generateAnthropicToolUseFromSdk,
} from "../fake-data.js";

// Stop reason type
type StopReason = "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";

// Simplified stream event types for mock server
interface StreamEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * Handle non-streaming Anthropic message request
 */
export function handleNonStreaming(
  req: MessageCreateParams,
  config: ServerConfig,
): MockMessage {
  const id = generateAnthropicMessageId();

  // Decide whether to make a tool call
  const toolChoice = req.tool_choice as { type?: string } | undefined;
  const shouldMakeToolCall =
    req.tools &&
    req.tools.length > 0 &&
    toolChoice?.type !== "none" &&
    (toolChoice?.type === "any" ||
      toolChoice?.type === "tool" ||
      Math.random() < config.toolCallProbability);

  let content: ContentBlock[] = [];
  let stopReason: StopReason = "end_turn";

  if (shouldMakeToolCall && req.tools) {
    const toolUse = generateAnthropicToolUseFromSdk(req.tools as Tool[]);
    if (toolUse) {
      // Anthropic often returns text before tool use
      const textContent = config.getDefaultResponse();
      content = [{ type: "text", text: textContent } as TextBlock, toolUse];
      stopReason = "tool_use";
    } else {
      // Fallback to text response if no valid tool use generated
      content = [
        { type: "text", text: config.getDefaultResponse() } as TextBlock,
      ];
    }
  } else {
    content = [
      { type: "text", text: config.getDefaultResponse() } as TextBlock,
    ];
  }

  const inputTokens = estimateTokens(
    req.messages
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join(" "),
  );
  const outputTokens = estimateTokens(
    content
      .map((c) =>
        c.type === "text" ? (c as TextBlock).text : JSON.stringify(c),
      )
      .join(" "),
  );

  return {
    id,
    type: "message",
    role: "assistant",
    content,
    model: req.model,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  };
}

/**
 * Handle streaming Anthropic message request
 */
export async function handleStreaming(
  req: MessageCreateParams,
  res: Response,
  config: ServerConfig,
): Promise<void> {
  const id = generateAnthropicMessageId();

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (event: StreamEvent) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Decide whether to make a tool call
  const toolChoice = req.tool_choice as { type?: string } | undefined;
  const shouldMakeToolCall =
    req.tools &&
    req.tools.length > 0 &&
    toolChoice?.type !== "none" &&
    (toolChoice?.type === "any" ||
      toolChoice?.type === "tool" ||
      Math.random() < config.toolCallProbability);

  const inputTokens = estimateTokens(
    req.messages
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join(" "),
  );

  // Initial delay (time to first token)
  await sleep(config.streamInitialDelayMs);

  if (shouldMakeToolCall && req.tools) {
    const toolUse = generateAnthropicToolUseFromSdk(req.tools as Tool[]);
    if (toolUse) {
      await streamWithToolUse(req, id, inputTokens, toolUse, config, sendEvent);
    } else {
      await streamTextContent(req, id, inputTokens, config, sendEvent);
    }
  } else {
    await streamTextContent(req, id, inputTokens, config, sendEvent);
  }

  res.end();
}

async function streamTextContent(
  req: MessageCreateParams,
  id: string,
  inputTokens: number,
  config: ServerConfig,
  sendEvent: (event: StreamEvent) => void,
): Promise<void> {
  const content = config.getDefaultResponse();
  const outputTokens = estimateTokens(content);

  // message_start event
  sendEvent({
    type: "message_start",
    message: {
      id,
      type: "message",
      role: "assistant",
      content: [],
      model: req.model,
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: inputTokens,
        output_tokens: 0,
      },
    },
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // content_block_start event for text
  sendEvent({
    type: "content_block_start",
    index: 0,
    content_block: {
      type: "text",
      text: "",
    },
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // Stream content in chunks via content_block_delta events
  for (let i = 0; i < content.length; i += config.streamChunkSize) {
    const chunk = content.slice(i, i + config.streamChunkSize);

    sendEvent({
      type: "content_block_delta",
      index: 0,
      delta: {
        type: "text_delta",
        text: chunk,
      },
    });

    await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);
  }

  // content_block_stop event
  sendEvent({
    type: "content_block_stop",
    index: 0,
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // message_delta event
  sendEvent({
    type: "message_delta",
    delta: {
      stop_reason: "end_turn",
      stop_sequence: null,
    },
    usage: {
      output_tokens: outputTokens,
    },
  });

  // message_stop event
  sendEvent({
    type: "message_stop",
  });
}

async function streamWithToolUse(
  req: MessageCreateParams,
  id: string,
  inputTokens: number,
  toolUse: ToolUseBlock,
  config: ServerConfig,
  sendEvent: (event: StreamEvent) => void,
): Promise<void> {
  const textContent = config.getDefaultResponse();
  const toolInputJson = JSON.stringify(toolUse.input);
  const outputTokens = estimateTokens(textContent + toolInputJson);

  // message_start event
  sendEvent({
    type: "message_start",
    message: {
      id,
      type: "message",
      role: "assistant",
      content: [],
      model: req.model,
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: inputTokens,
        output_tokens: 0,
      },
    },
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // First content block: text
  sendEvent({
    type: "content_block_start",
    index: 0,
    content_block: {
      type: "text",
      text: "",
    },
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // Stream text content
  for (let i = 0; i < textContent.length; i += config.streamChunkSize) {
    const chunk = textContent.slice(i, i + config.streamChunkSize);

    sendEvent({
      type: "content_block_delta",
      index: 0,
      delta: {
        type: "text_delta",
        text: chunk,
      },
    });

    await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);
  }

  sendEvent({
    type: "content_block_stop",
    index: 0,
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // Second content block: tool_use
  sendEvent({
    type: "content_block_start",
    index: 1,
    content_block: {
      type: "tool_use",
      id: toolUse.id,
      name: toolUse.name,
      input: {},
    },
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // Stream tool input JSON in chunks
  for (let i = 0; i < toolInputJson.length; i += config.streamChunkSize) {
    const chunk = toolInputJson.slice(i, i + config.streamChunkSize);

    sendEvent({
      type: "content_block_delta",
      index: 1,
      delta: {
        type: "input_json_delta",
        partial_json: chunk,
      },
    });

    await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);
  }

  sendEvent({
    type: "content_block_stop",
    index: 1,
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // message_delta event
  sendEvent({
    type: "message_delta",
    delta: {
      stop_reason: "tool_use",
      stop_sequence: null,
    },
    usage: {
      output_tokens: outputTokens,
    },
  });

  // message_stop event
  sendEvent({
    type: "message_stop",
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sleepWithJitter(baseMs: number, jitterMs: number): Promise<void> {
  const jitter = Math.random() * jitterMs;
  return sleep(baseMs + jitter);
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}
