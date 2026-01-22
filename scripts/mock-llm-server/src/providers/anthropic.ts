import type { Request, Response } from "express";
import type { Provider, ValidationResult, HandlerConfig } from "./types.js";
import type { MessageCreateParams } from "@anthropic-ai/sdk/resources/messages";
import {
  handleNonStreaming,
  handleStreaming,
} from "../handlers/anthropic-messages.js";

/**
 * Anthropic Messages API Provider
 */
export const anthropicProvider: Provider = {
  id: "anthropic-messages",
  label: "Anthropic Messages",
  routePath: "/v1/messages",
  method: "POST",

  validateRequest(req: Request): ValidationResult {
    const body = req.body as MessageCreateParams;

    if (!body.model) {
      return { valid: false, message: "model: Field required", field: "model" };
    }

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return { valid: false, message: "messages: Field required", field: "messages" };
    }

    if (!body.max_tokens || typeof body.max_tokens !== "number") {
      return { valid: false, message: "max_tokens: Field required", field: "max_tokens" };
    }

    return { valid: true };
  },

  isStreamingRequest(req: Request): boolean {
    return !!req.body.stream;
  },

  formatRateLimitError(retryAfter: number): unknown {
    return {
      type: "error",
      error: {
        type: "rate_limit_error",
        message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
      },
    };
  },

  formatValidationError(message: string): unknown {
    return {
      type: "error",
      error: {
        type: "invalid_request_error",
        message,
      },
    };
  },

  formatServerError(message = "Internal server error"): unknown {
    return {
      type: "error",
      error: {
        type: "api_error",
        message,
      },
    };
  },

  formatDisabledError(): unknown {
    return {
      type: "error",
      error: {
        type: "api_error",
        message: "This endpoint is currently disabled",
      },
    };
  },

  handleNonStreaming(req: Request, config: HandlerConfig): unknown {
    const body = req.body as MessageCreateParams;
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
    return handleNonStreaming(body, serverConfig);
  },

  async handleStreaming(req: Request, res: Response, config: HandlerConfig): Promise<void> {
    const body = req.body as MessageCreateParams;
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
