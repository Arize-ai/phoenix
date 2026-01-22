import type { Request, Response } from "express";

/**
 * Endpoint identifiers
 */
export type EndpointId =
  | "openai-chat"
  | "openai-responses"
  | "anthropic-messages"
  | "gemini-generate"
  | "gemini-stream"
  | "gemini-generate-v1"
  | "gemini-stream-v1";

export const ENDPOINT_IDS: EndpointId[] = [
  "openai-chat",
  "openai-responses",
  "anthropic-messages",
  "gemini-generate",
  "gemini-stream",
  "gemini-generate-v1",
  "gemini-stream-v1",
];

export const ENDPOINT_LABELS: Record<EndpointId, string> = {
  "openai-chat": "OpenAI Chat Completions",
  "openai-responses": "OpenAI Responses",
  "anthropic-messages": "Anthropic Messages",
  "gemini-generate": "Gemini Generate (v1beta)",
  "gemini-stream": "Gemini Stream (v1beta)",
  "gemini-generate-v1": "Gemini Generate (v1)",
  "gemini-stream-v1": "Gemini Stream (v1)",
};

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  message?: string;
  field?: string;
}

/**
 * Runtime configuration passed to handlers
 */
export interface HandlerConfig {
  streamInitialDelayMs: number;
  streamDelayMs: number;
  streamJitterMs: number;
  streamChunkSize: number;
  toolCallProbability: number;
  getDefaultResponse: () => string;
}

/**
 * Provider interface - implemented by each LLM provider
 */
export interface Provider {
  /**
   * Unique identifier for this endpoint
   */
  readonly id: EndpointId;

  /**
   * Human-readable label
   */
  readonly label: string;

  /**
   * Express route path pattern
   */
  readonly routePath: string;

  /**
   * HTTP method
   */
  readonly method: "GET" | "POST";

  /**
   * Validate incoming request
   */
  validateRequest(req: Request): ValidationResult;

  /**
   * Check if this is a streaming request
   */
  isStreamingRequest(req: Request): boolean;

  /**
   * Format a rate limit error response for this provider's API format
   */
  formatRateLimitError(retryAfter: number): unknown;

  /**
   * Format a validation error response for this provider's API format
   */
  formatValidationError(message: string, field?: string): unknown;

  /**
   * Format a server error response for this provider's API format
   */
  formatServerError(message?: string): unknown;

  /**
   * Format an authentication error response (401) for this provider's API format
   */
  formatAuthenticationError(message?: string): unknown;

  /**
   * Format a permission denied error response (403) for this provider's API format
   */
  formatPermissionDeniedError(message?: string): unknown;

  /**
   * Format a disabled endpoint error response
   */
  formatDisabledError(): unknown;

  /**
   * Handle non-streaming request
   */
  handleNonStreaming(req: Request, config: HandlerConfig): unknown;

  /**
   * Handle streaming request
   */
  handleStreaming(
    req: Request,
    res: Response,
    config: HandlerConfig,
  ): Promise<void>;
}
