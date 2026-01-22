import type { Response } from "express";
import type {
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import type { ServerConfig } from "../types.js";
import { generateCompletionId, generateToolCalls } from "../fake-data.js";

// Delta tool call type for streaming (partial type from SDK)
interface DeltaToolCall {
  index: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

// Simplified response type for mock server
interface MockChatCompletion {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: ChatCompletionMessageToolCall[];
    };
    finish_reason: "stop" | "tool_calls";
    logprobs: null;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint: string;
}

/**
 * Handle non-streaming chat completion request
 */
export function handleNonStreaming(
  req: ChatCompletionCreateParams,
  config: ServerConfig
): MockChatCompletion {
  const id = generateCompletionId();
  const created = Math.floor(Date.now() / 1000);

  // Decide whether to make a tool call
  const shouldMakeToolCall =
    req.tools &&
    req.tools.length > 0 &&
    req.tool_choice !== "none" &&
    (req.tool_choice === "required" ||
      Math.random() < config.toolCallProbability);

  let content: string | null = null;
  let toolCalls: ChatCompletionMessageToolCall[] | undefined = undefined;
  let finishReason: "stop" | "tool_calls" = "stop";

  if (shouldMakeToolCall && req.tools) {
    const generatedCalls = generateToolCalls(req.tools, 1);
    if (generatedCalls.length > 0) {
      toolCalls = generatedCalls;
      content = null;
      finishReason = "tool_calls";
    } else {
      // Fallback to text response if no valid tool calls generated
      content = config.getDefaultResponse();
    }
  } else {
    content = config.getDefaultResponse();
  }

  const promptTokens = estimateTokens(
    req.messages.map((m) => (typeof m.content === "string" ? m.content : "")).join(" ")
  );
  const completionTokens = estimateTokens(content || "");

  return {
    id,
    object: "chat.completion",
    created,
    model: req.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
          tool_calls: toolCalls,
        },
        finish_reason: finishReason,
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
    system_fingerprint: "fp_mock_server",
  };
}

/**
 * Handle streaming chat completion request
 */
export async function handleStreaming(
  req: ChatCompletionCreateParams,
  res: Response,
  config: ServerConfig
): Promise<void> {
  const id = generateCompletionId();
  const created = Math.floor(Date.now() / 1000);

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendChunk = (chunk: ChatCompletionChunk) => {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  };

  // Decide whether to make a tool call
  const shouldMakeToolCall =
    req.tools &&
    req.tools.length > 0 &&
    req.tool_choice !== "none" &&
    (req.tool_choice === "required" ||
      Math.random() < config.toolCallProbability);

  if (shouldMakeToolCall && req.tools) {
    await streamToolCall(req, res, id, created, config, sendChunk);
  } else {
    await streamTextContent(req, res, id, created, config, sendChunk);
  }

  // Send usage in final chunk if requested
  if (req.stream_options?.include_usage) {
    const promptTokens = estimateTokens(
      req.messages.map((m) => (typeof m.content === "string" ? m.content : "")).join(" ")
    );
    const completionTokens = estimateTokens(config.getDefaultResponse());

    const usageChunk: ChatCompletionChunk = {
      id,
      object: "chat.completion.chunk",
      created,
      model: req.model,
      choices: [],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    };
    sendChunk(usageChunk);
  }

  // Send done
  res.write("data: [DONE]\n\n");
  res.end();
}

async function streamTextContent(
  req: ChatCompletionCreateParams,
  _res: Response,
  id: string,
  created: number,
  config: ServerConfig,
  sendChunk: (chunk: ChatCompletionChunk) => void
): Promise<void> {
  const content = config.getDefaultResponse();

  // Initial delay (time to first token)
  await sleep(config.streamInitialDelayMs);

  // First chunk with role
  sendChunk({
    id,
    object: "chat.completion.chunk",
    created,
    model: req.model,
    choices: [
      {
        index: 0,
        delta: { role: "assistant", content: "" },
        finish_reason: null,
        logprobs: null,
      },
    ],
    system_fingerprint: "fp_mock_server",
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // Stream content in chunks
  for (let i = 0; i < content.length; i += config.streamChunkSize) {
    const chunk = content.slice(i, i + config.streamChunkSize);

    sendChunk({
      id,
      object: "chat.completion.chunk",
      created,
      model: req.model,
      choices: [
        {
          index: 0,
          delta: { content: chunk },
          finish_reason: null,
          logprobs: null,
        },
      ],
      system_fingerprint: "fp_mock_server",
    });

    await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);
  }

  // Final chunk with finish_reason
  sendChunk({
    id,
    object: "chat.completion.chunk",
    created,
    model: req.model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
        logprobs: null,
      },
    ],
    system_fingerprint: "fp_mock_server",
  });
}

async function streamToolCall(
  req: ChatCompletionCreateParams,
  res: Response,
  id: string,
  created: number,
  config: ServerConfig,
  sendChunk: (chunk: ChatCompletionChunk) => void
): Promise<void> {
  const toolCalls = generateToolCalls(req.tools!, 1);
  const toolCall = toolCalls[0];

  // Guard: if no valid tool call was generated, fall back to text
  if (!toolCall || !toolCall.function?.name) {
    await streamTextContent(req, res, id, created, config, sendChunk);
    return;
  }

  // Initial delay (time to first token)
  await sleep(config.streamInitialDelayMs);

  // First chunk with role
  sendChunk({
    id,
    object: "chat.completion.chunk",
    created,
    model: req.model,
    choices: [
      {
        index: 0,
        delta: { role: "assistant", content: null },
        finish_reason: null,
        logprobs: null,
      },
    ],
    system_fingerprint: "fp_mock_server",
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // Tool call header (id, type, function name)
  const headerDelta: DeltaToolCall = {
    index: 0,
    id: toolCall.id,
    type: "function",
    function: {
      name: toolCall.function.name,
      arguments: "",
    },
  };

  sendChunk({
    id,
    object: "chat.completion.chunk",
    created,
    model: req.model,
    choices: [
      {
        index: 0,
        delta: { tool_calls: [headerDelta] },
        finish_reason: null,
        logprobs: null,
      },
    ],
    system_fingerprint: "fp_mock_server",
  });

  await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);

  // Stream arguments in chunks
  const args = toolCall.function.arguments;
  for (let i = 0; i < args.length; i += config.streamChunkSize) {
    const chunk = args.slice(i, i + config.streamChunkSize);

    const argDelta: DeltaToolCall = {
      index: 0,
      function: {
        arguments: chunk,
      },
    };

    sendChunk({
      id,
      object: "chat.completion.chunk",
      created,
      model: req.model,
      choices: [
        {
          index: 0,
          delta: { tool_calls: [argDelta] },
          finish_reason: null,
          logprobs: null,
        },
      ],
      system_fingerprint: "fp_mock_server",
    });

    await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);
  }

  // Final chunk with finish_reason
  sendChunk({
    id,
    object: "chat.completion.chunk",
    created,
    model: req.model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "tool_calls",
        logprobs: null,
      },
    ],
    system_fingerprint: "fp_mock_server",
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
