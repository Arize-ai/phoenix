import type { Response } from "express";
import type {
  FunctionDeclaration,
  Tool,
  Content,
  Part,
} from "@google/genai";
import type { ServerConfig, JSONSchema } from "../types.js";
import { generateFakeData } from "../fake-data.js";
import type { GenerateContentParameters } from "@google/genai";

// Simplified response type for mock server
interface MockGenerateContentResponse {
  candidates: {
    content: {
      role: string;
      parts: Part[];
    };
    finishReason?: string;
    index: number;
  }[];
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion: string;
  responseId: string;
}

/**
 * Generate a Gemini response ID
 */
function generateResponseId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 22; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// Raw request body structure from the SDK (different from GenerateContentParameters)
interface GeminiRequestBody {
  contents: GenerateContentParameters["contents"];
  tools?: Tool[];
  toolConfig?: {
    functionCallingConfig?: {
      mode?: string;
      allowedFunctionNames?: string[];
    };
  };
  generationConfig?: Record<string, unknown>;
  systemInstruction?: { parts?: { text?: string }[] };
}

/**
 * Extract all function declarations from tools
 */
function extractFunctionDeclarations(
  body: GeminiRequestBody
): FunctionDeclaration[] {
  const declarations: FunctionDeclaration[] = [];
  for (const tool of body.tools || []) {
    if (tool.functionDeclarations) {
      declarations.push(...tool.functionDeclarations);
    }
  }
  return declarations;
}

/**
 * Get tool config from request
 */
function getToolConfig(body: GeminiRequestBody) {
  return body.toolConfig?.functionCallingConfig;
}

/**
 * Handle non-streaming Gemini generateContent request
 */
export function handleNonStreaming(
  model: string,
  request: GeminiRequestBody,
  config: ServerConfig
): MockGenerateContentResponse {
  const responseId = generateResponseId();
  const functionDeclarations = extractFunctionDeclarations(request);

  // Decide whether to make a function call
  const toolConfig = getToolConfig(request);
  const shouldMakeFunctionCall =
    functionDeclarations.length > 0 &&
    toolConfig?.mode !== "NONE" &&
    (toolConfig?.mode === "ANY" || Math.random() < config.toolCallProbability);

  let candidate: MockGenerateContentResponse["candidates"][0];
  const finishReason = "STOP";

  if (shouldMakeFunctionCall) {
    // Pick a function to call
    let functionToCall: FunctionDeclaration;
    if (
      toolConfig?.allowedFunctionNames &&
      toolConfig.allowedFunctionNames.length > 0
    ) {
      const allowedFunctions = functionDeclarations.filter((f) =>
        toolConfig.allowedFunctionNames!.includes(f.name!)
      );
      functionToCall =
        allowedFunctions[Math.floor(Math.random() * allowedFunctions.length)];
    } else {
      functionToCall =
        functionDeclarations[
          Math.floor(Math.random() * functionDeclarations.length)
        ];
    }

    const schema = (functionToCall as { parametersJsonSchema?: JSONSchema }).parametersJsonSchema || functionToCall.parameters;
    const args = generateFakeData(schema as JSONSchema) as Record<string, unknown>;

    candidate = {
      content: {
        role: "model",
        parts: [
          {
            functionCall: {
              name: functionToCall.name,
              args,
            },
          },
        ],
      },
      finishReason: "STOP",
      index: 0,
    };
  } else {
    const responseText = config.getDefaultResponse();
    candidate = {
      content: {
        role: "model",
        parts: [{ text: responseText }],
      },
      finishReason,
      index: 0,
    };
  }

  const contentsText = extractContentsText(request.contents);

  const promptTokens = estimateTokens(contentsText);
  const candidateTokens = estimateTokens(
    candidate.content?.parts
      ?.map((p) => ("text" in p ? (p as { text: string }).text : JSON.stringify(p)))
      .join(" ") || ""
  );

  return {
    candidates: [candidate],
    usageMetadata: {
      promptTokenCount: promptTokens,
      candidatesTokenCount: candidateTokens,
      totalTokenCount: promptTokens + candidateTokens,
    },
    modelVersion: model,
    responseId,
  };
}

/**
 * Extract text from contents (handles both string and Content[] formats)
 */
function extractContentsText(contents: GeminiRequestBody["contents"]): string {
  if (typeof contents === "string") {
    return contents;
  }
  if (Array.isArray(contents)) {
    return contents
      .flatMap((c) => {
        if (typeof c === "string") return [c];
        const content = c as Content;
        return content.parts?.map((p) => {
          if (typeof p === "string") return p;
          return "text" in p ? (p as { text: string }).text : "";
        }) || [];
      })
      .join(" ");
  }
  return "";
}

/**
 * Handle streaming Gemini generateContent request
 */
export async function handleStreaming(
  model: string,
  request: GeminiRequestBody,
  res: Response,
  config: ServerConfig
): Promise<void> {
  const responseId = generateResponseId();
  const functionDeclarations = extractFunctionDeclarations(request);

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendChunk = (chunk: MockGenerateContentResponse) => {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  };

  // Decide whether to make a function call
  const toolConfig = getToolConfig(request);
  const shouldMakeFunctionCall =
    functionDeclarations.length > 0 &&
    toolConfig?.mode !== "NONE" &&
    (toolConfig?.mode === "ANY" || Math.random() < config.toolCallProbability);

  const contentsText = extractContentsText(request.contents);
  const promptTokens = estimateTokens(contentsText);

  // Initial delay (time to first token)
  await sleep(config.streamInitialDelayMs);

  if (shouldMakeFunctionCall) {
    await streamFunctionCall(
      model,
      request,
      responseId,
      functionDeclarations,
      promptTokens,
      config,
      sendChunk
    );
  } else {
    await streamTextContent(
      model,
      responseId,
      promptTokens,
      config,
      sendChunk
    );
  }

  res.end();
}

async function streamTextContent(
  model: string,
  responseId: string,
  promptTokens: number,
  config: ServerConfig,
  sendChunk: (chunk: MockGenerateContentResponse) => void
): Promise<void> {
  const content = config.getDefaultResponse();
  let candidateTokens = 0;

  // Stream content in chunks
  for (let i = 0; i < content.length; i += config.streamChunkSize) {
    const isLast = i + config.streamChunkSize >= content.length;
    const chunk = content.slice(i, i + config.streamChunkSize);
    candidateTokens = estimateTokens(content.slice(0, i + config.streamChunkSize));

    const response: MockGenerateContentResponse = {
      candidates: [
        {
          content: {
            role: "model",
            parts: [{ text: chunk }],
          },
          index: 0,
          ...(isLast && { finishReason: "STOP" }),
        },
      ],
      usageMetadata: {
        promptTokenCount: promptTokens,
        candidatesTokenCount: candidateTokens,
        totalTokenCount: promptTokens + candidateTokens,
      },
      modelVersion: model,
      responseId,
    };

    sendChunk(response);
    await sleepWithJitter(config.streamDelayMs, config.streamJitterMs);
  }
}

async function streamFunctionCall(
  model: string,
  request: GeminiRequestBody,
  responseId: string,
  functionDeclarations: FunctionDeclaration[],
  promptTokens: number,
  _config: ServerConfig,
  sendChunk: (chunk: MockGenerateContentResponse) => void
): Promise<void> {
  const toolConfig = getToolConfig(request);

  // Pick a function to call
  let functionToCall: FunctionDeclaration;
  if (
    toolConfig?.allowedFunctionNames &&
    toolConfig.allowedFunctionNames.length > 0
  ) {
    const allowedFunctions = functionDeclarations.filter((f) =>
      toolConfig.allowedFunctionNames!.includes(f.name!)
    );
    functionToCall =
      allowedFunctions[Math.floor(Math.random() * allowedFunctions.length)];
  } else {
    functionToCall =
      functionDeclarations[
        Math.floor(Math.random() * functionDeclarations.length)
      ];
  }

  const schema = (functionToCall as { parametersJsonSchema?: JSONSchema }).parametersJsonSchema || functionToCall.parameters;
  const args = generateFakeData(schema as JSONSchema) as Record<string, unknown>;

  const candidateTokens = estimateTokens(
    (functionToCall.name || "") + JSON.stringify(args)
  );

  // For function calls, we send a single chunk with the complete function call
  const response: MockGenerateContentResponse = {
    candidates: [
      {
        content: {
          role: "model",
          parts: [
            {
              functionCall: {
                name: functionToCall.name,
                args,
              },
            },
          ],
        },
        finishReason: "STOP",
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: promptTokens,
      candidatesTokenCount: candidateTokens,
      totalTokenCount: promptTokens + candidateTokens,
    },
    modelVersion: model,
    responseId,
  };

  sendChunk(response);
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
