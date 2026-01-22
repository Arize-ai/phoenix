// Re-export types from SDKs for use in handlers
// This keeps types in sync with the official SDKs

// ============================================
// OpenAI Types (from openai SDK)
// ============================================
export type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions";

// ============================================
// Anthropic Types (from @anthropic-ai/sdk)
// ============================================
export type {
  Message as AnthropicMessage,
  MessageCreateParams as AnthropicMessageCreateParams,
  MessageCreateParamsNonStreaming as AnthropicMessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming as AnthropicMessageCreateParamsStreaming,
  MessageParam as AnthropicMessageParam,
  ContentBlock as AnthropicContentBlock,
  TextBlock as AnthropicTextBlock,
  ToolUseBlock as AnthropicToolUseBlock,
  ToolResultBlockParam as AnthropicToolResultBlockParam,
  Tool as AnthropicTool,
  RawMessageStreamEvent as AnthropicRawMessageStreamEvent,
  MessageStreamEvent as AnthropicMessageStreamEvent,
  Usage as AnthropicUsage,
} from "@anthropic-ai/sdk/resources/messages";

// ============================================
// Google GenAI Types (from @google/genai)
// ============================================
export type {
  Content as GeminiContent,
  Part as GeminiPart,
  FunctionDeclaration as GeminiFunctionDeclaration,
  Tool as GeminiTool,
  GenerateContentParameters as GeminiGenerateContentParameters,
  GenerateContentConfig as GeminiGenerateContentConfig,
  GenerateContentResponse as GeminiGenerateContentResponse,
  Candidate as GeminiCandidate,
  FunctionCall as GeminiFunctionCall,
} from "@google/genai";

// ============================================
// Internal Types for Mock Server
// ============================================

// JSON Schema type used for generating fake data
export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: unknown[];
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

// Server configuration
export interface ServerConfig {
  port: number;
  // Rate limiting
  rateLimitEnabled: boolean;
  rateLimitRequests: number;
  rateLimitWindowMs: number;
  rateLimitFailureMode: "always" | "random" | "after_n";
  rateLimitRandomProbability: number;
  rateLimitAfterN: number;
  // Streaming
  streamInitialDelayMs: number;
  streamDelayMs: number;
  streamJitterMs: number;
  streamChunkSize: number;
  // Tool calls
  toolCallProbability: number;
  // Response content
  getDefaultResponse: () => string;
}

// ============================================
// OpenAI Responses API Types (not in SDK yet)
// ============================================

export interface ResponseCreateRequest {
  model: string;
  input?: string | ResponseInputItem[];
  instructions?: string;
  tools?: ResponseTool[];
  tool_choice?: "auto" | "none" | "required" | { type: "function"; name: string };
  stream?: boolean;
  stream_options?: { include_usage?: boolean };
  temperature?: number;
  max_output_tokens?: number;
  metadata?: Record<string, string>;
}

export interface ResponseInputItem {
  type: "message";
  role: "user" | "assistant" | "system";
  content: string | ResponseInputContent[];
}

export interface ResponseInputContent {
  type: "input_text" | "input_image" | "input_file";
  text?: string;
}

export interface ResponseTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: JSONSchema;
    strict?: boolean;
  };
}

export interface ResponseObject {
  id: string;
  object: "response";
  created_at: number;
  model: string;
  status: "completed" | "failed" | "in_progress" | "incomplete";
  output: ResponseOutputItem[];
  usage?: ResponseUsage;
  metadata?: Record<string, string>;
  error?: ResponseError | null;
  incomplete_details?: { reason: string } | null;
}

export interface ResponseOutputItem {
  type: "message" | "function_call";
  id: string;
  status: "completed" | "in_progress";
  role?: "assistant";
  content?: ResponseOutputContent[];
  call_id?: string;
  name?: string;
  arguments?: string;
}

export interface ResponseOutputContent {
  type: "output_text";
  text: string;
  annotations?: unknown[];
}

export interface ResponseUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface ResponseError {
  type: string;
  message: string;
}
