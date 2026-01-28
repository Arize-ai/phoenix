import type { Request, Response } from "express";
import type { Provider, ValidationResult, HandlerConfig } from "./types.js";
import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import {
  handleNonStreaming,
  handleStreaming,
} from "../handlers/chat-completions.js";

/**
 * OpenAI Chat Completions API Provider
 */
export const openaiChatProvider: Provider = {
  id: "openai-chat",
  label: "OpenAI Chat Completions",
  routePath: "/v1/chat/completions",
  method: "POST",

  validateRequest(req: Request): ValidationResult {
    const body = req.body as ChatCompletionCreateParams;

    if (!body.model) {
      return { valid: false, message: "model is required", field: "model" };
    }

    if (
      !body.messages ||
      !Array.isArray(body.messages) ||
      body.messages.length === 0
    ) {
      return {
        valid: false,
        message: "messages is required and must be non-empty",
        field: "messages",
      };
    }

    return { valid: true };
  },

  isStreamingRequest(req: Request): boolean {
    return !!req.body.stream;
  },

  formatRateLimitError(retryAfter: number): unknown {
    return {
      error: {
        message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
        type: "rate_limit_error",
        code: "rate_limit_exceeded",
      },
    };
  },

  formatValidationError(message: string, field?: string): unknown {
    return {
      error: {
        message,
        type: "invalid_request_error",
        param: field,
      },
    };
  },

  formatServerError(message = "Internal server error"): unknown {
    return {
      error: {
        message,
        type: "server_error",
      },
    };
  },

  formatAuthenticationError(message = "Incorrect API key provided"): unknown {
    return {
      error: {
        message,
        type: "invalid_api_key",
        code: "invalid_api_key",
      },
    };
  },

  formatPermissionDeniedError(
    message = "You don't have access to this resource",
  ): unknown {
    return {
      error: {
        message,
        type: "insufficient_quota",
        code: "insufficient_quota",
      },
    };
  },

  formatDisabledError(): unknown {
    return {
      error: {
        message: "This endpoint is currently disabled",
        type: "service_unavailable",
      },
    };
  },

  handleNonStreaming(req: Request, config: HandlerConfig): unknown {
    const body = req.body as ChatCompletionCreateParams;
    // Adapt config to legacy ServerConfig format
    const serverConfig = {
      ...config,
      port: 0, // Not used
      rateLimitEnabled: false,
      rateLimitRequests: 0,
      rateLimitWindowMs: 0,
      rateLimitFailureMode: "after_n" as const,
      rateLimitRandomProbability: 0,
      rateLimitAfterN: 0,
    };
    return handleNonStreaming(body, serverConfig);
  },

  async handleStreaming(
    req: Request,
    res: Response,
    config: HandlerConfig,
  ): Promise<void> {
    const body = req.body as ChatCompletionCreateParams;
    const serverConfig = {
      ...config,
      port: 0,
      rateLimitEnabled: false,
      rateLimitRequests: 0,
      rateLimitWindowMs: 0,
      rateLimitFailureMode: "after_n" as const,
      rateLimitRandomProbability: 0,
      rateLimitAfterN: 0,
    };
    await handleStreaming(body, res, serverConfig);
  },
};
