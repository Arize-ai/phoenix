import type { Request, Response } from "express";
import type { Provider, ValidationResult, HandlerConfig } from "./types.js";
import type { ResponseCreateRequest } from "../types.js";
import { handleNonStreaming, handleStreaming } from "../handlers/responses.js";

/**
 * OpenAI Responses API Provider
 */
export const openaiResponsesProvider: Provider = {
  id: "openai-responses",
  label: "OpenAI Responses",
  routePath: "/v1/responses",
  method: "POST",

  validateRequest(req: Request): ValidationResult {
    const body = req.body as ResponseCreateRequest;

    if (!body.model) {
      return {
        valid: false,
        message: "Missing required parameter: model",
        field: "model",
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
        code: "missing_required_parameter",
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
    const body = req.body as ResponseCreateRequest;
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

  async handleStreaming(
    req: Request,
    res: Response,
    config: HandlerConfig,
  ): Promise<void> {
    const body = req.body as ResponseCreateRequest;
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
