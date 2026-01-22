import type { Response } from "express";
import type {
  ResponseCreateRequest,
  ResponseObject,
  ResponseOutputItem,
  ResponseOutputContent,
  ServerConfig,
} from "../types.js";
import { generateToolCallId, generateFakeData } from "../fake-data.js";

/**
 * Generate a response ID
 */
function generateResponseId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "resp_";
  for (let i = 0; i < 24; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Generate an output item ID
 */
function generateItemId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "item_";
  for (let i = 0; i < 24; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Estimate tokens from text
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Extract input text from request
 */
function getInputText(req: ResponseCreateRequest): string {
  if (typeof req.input === "string") {
    return req.input;
  }
  if (Array.isArray(req.input)) {
    return req.input
      .map((item) => {
        if (typeof item.content === "string") {
          return item.content;
        }
        if (Array.isArray(item.content)) {
          return item.content
            .filter((c) => c.type === "input_text")
            .map((c) => c.text || "")
            .join(" ");
        }
        return "";
      })
      .join(" ");
  }
  return "";
}

/**
 * Handle non-streaming response
 */
export function handleNonStreaming(
  req: ResponseCreateRequest,
  config: ServerConfig
): ResponseObject {
  const id = generateResponseId();
  const createdAt = Date.now() / 1000;

  // Decide whether to make a tool call
  const shouldMakeToolCall =
    req.tools &&
    req.tools.length > 0 &&
    req.tool_choice !== "none" &&
    (req.tool_choice === "required" ||
      Math.random() < config.toolCallProbability);

  const output: ResponseOutputItem[] = [];

  if (shouldMakeToolCall && req.tools) {
    // Generate a function call
    const tool = req.tools[Math.floor(Math.random() * req.tools.length)];
    
    // Guard: ensure tool has valid function name
    if (tool?.function?.name) {
      const args = generateFakeData(tool.function.parameters);

      output.push({
        type: "function_call",
        id: generateItemId(),
        status: "completed",
        call_id: generateToolCallId(),
        name: tool.function.name,
        arguments: JSON.stringify(args),
      });
    } else {
      // Fallback to text response if tool is invalid
      const content: ResponseOutputContent = {
        type: "output_text",
        text: config.getDefaultResponse(),
        annotations: [],
      };

      output.push({
        type: "message",
        id: generateItemId(),
        status: "completed",
        role: "assistant",
        content: [content],
      });
    }
  } else {
    // Generate a message
    const content: ResponseOutputContent = {
      type: "output_text",
      text: config.getDefaultResponse(),
      annotations: [],
    };

    output.push({
      type: "message",
      id: generateItemId(),
      status: "completed",
      role: "assistant",
      content: [content],
    });
  }

  const inputText = getInputText(req);
  const outputText = output
    .map((o) =>
      o.type === "message"
        ? o.content?.map((c) => c.text).join("") || ""
        : o.arguments || ""
    )
    .join("");

  return {
    id,
    object: "response",
    created_at: createdAt,
    model: req.model,
    status: "completed",
    output,
    usage: {
      input_tokens: estimateTokens(inputText),
      output_tokens: estimateTokens(outputText),
      total_tokens: estimateTokens(inputText) + estimateTokens(outputText),
    },
    metadata: req.metadata || {},
    error: null,
    incomplete_details: null,
  };
}

/**
 * Handle streaming response
 */
export async function handleStreaming(
  req: ResponseCreateRequest,
  res: Response,
  config: ServerConfig
): Promise<void> {
  const id = generateResponseId();
  const createdAt = Date.now() / 1000;

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (event: { type: string; [key: string]: unknown }) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Decide whether to make a tool call
  const shouldMakeToolCall =
    req.tools &&
    req.tools.length > 0 &&
    req.tool_choice !== "none" &&
    (req.tool_choice === "required" ||
      Math.random() < config.toolCallProbability);

  // Create initial response object
  const initialResponse: ResponseObject = {
    id,
    object: "response",
    created_at: createdAt,
    model: req.model,
    status: "in_progress",
    output: [],
    metadata: req.metadata || {},
    error: null,
    incomplete_details: null,
  };

  // Initial delay (time to first token)
  await sleep(config.streamInitialDelayMs);

  // Send response.created
  sendEvent({
    type: "response.created",
    response: initialResponse,
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // Send response.in_progress
  sendEvent({
    type: "response.in_progress",
    response: initialResponse,
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  if (shouldMakeToolCall && req.tools) {
    await streamFunctionCall(req, res, id, createdAt, config, sendEvent);
  } else {
    await streamTextContent(req, res, id, createdAt, config, sendEvent);
  }

  // Calculate usage
  const inputText = getInputText(req);
  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(config.getDefaultResponse());

  // Send response.completed
  const completedResponse: ResponseObject = {
    id,
    object: "response",
    created_at: createdAt,
    model: req.model,
    status: "completed",
    output: [], // Would need to track this
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
    metadata: req.metadata || {},
    error: null,
    incomplete_details: null,
  };

  sendEvent({
    type: "response.completed",
    response: completedResponse,
  });

  res.end();
}

async function streamTextContent(
  req: ResponseCreateRequest,
  res: Response,
  responseId: string,
  createdAt: number,
  config: ServerConfig,
  sendEvent: (event: { type: string; [key: string]: unknown }) => void
): Promise<void> {
  const content = config.getDefaultResponse();
  const itemId = generateItemId();

  // Send output_item.added
  const outputItem: ResponseOutputItem = {
    type: "message",
    id: itemId,
    status: "in_progress",
    role: "assistant",
    content: [],
  };

  sendEvent({
    type: "response.output_item.added",
    output_index: 0,
    item: outputItem,
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // Send content_part.added
  sendEvent({
    type: "response.content_part.added",
    output_index: 0,
    content_index: 0,
    part: {
      type: "output_text",
      text: "",
      annotations: [],
    },
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // Stream text deltas
  for (let i = 0; i < content.length; i += config.streamChunkSize) {
    const chunk = content.slice(i, i + config.streamChunkSize);

    sendEvent({
      type: "response.output_text.delta",
      output_index: 0,
      content_index: 0,
      delta: chunk,
    });

    await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);
  }

  // Send text done
  sendEvent({
    type: "response.output_text.done",
    output_index: 0,
    content_index: 0,
    text: content,
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // Send content_part.done
  sendEvent({
    type: "response.content_part.done",
    output_index: 0,
    content_index: 0,
    part: {
      type: "output_text",
      text: content,
      annotations: [],
    },
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // Send output_item.done
  sendEvent({
    type: "response.output_item.done",
    output_index: 0,
    item: {
      type: "message",
      id: itemId,
      status: "completed",
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: content,
          annotations: [],
        },
      ],
    },
  });
}

async function streamFunctionCall(
  req: ResponseCreateRequest,
  res: Response,
  responseId: string,
  createdAt: number,
  config: ServerConfig,
  sendEvent: (event: { type: string; [key: string]: unknown }) => void
): Promise<void> {
  const tool = req.tools![Math.floor(Math.random() * req.tools!.length)];
  
  // Guard: if tool is invalid, fall back to text streaming
  if (!tool?.function?.name) {
    await streamTextContent(req, res, responseId, createdAt, config, sendEvent);
    return;
  }
  
  const args = JSON.stringify(generateFakeData(tool.function.parameters));
  const itemId = generateItemId();
  const callId = generateToolCallId();

  // Send output_item.added
  const outputItem: ResponseOutputItem = {
    type: "function_call",
    id: itemId,
    status: "in_progress",
    call_id: callId,
    name: tool.function.name,
    arguments: "",
  };

  sendEvent({
    type: "response.output_item.added",
    output_index: 0,
    item: outputItem,
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // Stream arguments deltas
  for (let i = 0; i < args.length; i += config.streamChunkSize) {
    const chunk = args.slice(i, i + config.streamChunkSize);

    sendEvent({
      type: "response.function_call_arguments.delta",
      output_index: 0,
      call_id: callId,
      delta: chunk,
    });

    await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);
  }

  // Send arguments done
  sendEvent({
    type: "response.function_call_arguments.done",
    output_index: 0,
    call_id: callId,
    arguments: args,
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // Send output_item.done
  sendEvent({
    type: "response.output_item.done",
    output_index: 0,
    item: {
      type: "function_call",
      id: itemId,
      status: "completed",
      call_id: callId,
      name: tool.function.name,
      arguments: args,
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sleepWithJitter(baseMs: number, jitterMs: number): Promise<void> {
  const jitter = Math.random() * jitterMs;
  return sleep(baseMs + jitter);
}
