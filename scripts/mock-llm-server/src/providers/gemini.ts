import type { Request, Response } from "express";
import type { Provider, ValidationResult, HandlerConfig } from "./types.js";
import {
  handleNonStreaming,
  handleStreaming,
} from "../handlers/gemini.js";

/**
 * Google GenAI (Gemini) Generate Content API Provider (v1beta)
 */
export const geminiGenerateProvider: Provider = {
  id: "gemini-generate",
  label: "Gemini Generate (v1beta)",
  routePath: "/v1beta/models/:model\\:generateContent",
  method: "POST",

  validateRequest(req: Request): ValidationResult {
    const body = req.body;

    if (!body.contents || !Array.isArray(body.contents) || body.contents.length === 0) {
      return {
        valid: false,
        message: "contents is required and must be a non-empty array",
        field: "contents",
      };
    }

    return { valid: true };
  },

  isStreamingRequest(): boolean {
    return false; // This endpoint is always non-streaming
  },

  formatRateLimitError(): unknown {
    return {
      error: {
        code: 429,
        message: "Resource exhausted. Please try again later.",
        status: "RESOURCE_EXHAUSTED",
      },
    };
  },

  formatValidationError(message: string): unknown {
    return {
      error: {
        code: 400,
        message,
        status: "INVALID_ARGUMENT",
      },
    };
  },

  formatServerError(message = "Internal server error"): unknown {
    return {
      error: {
        code: 500,
        message,
        status: "INTERNAL",
      },
    };
  },

  formatDisabledError(): unknown {
    return {
      error: {
        code: 503,
        message: "This endpoint is currently disabled",
        status: "UNAVAILABLE",
      },
    };
  },

  handleNonStreaming(req: Request, config: HandlerConfig): unknown {
    const model = req.params.model;
    const body = req.body;
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
    return handleNonStreaming(model, body, serverConfig);
  },

  async handleStreaming(): Promise<void> {
    throw new Error("Streaming not supported on this endpoint. Use streamGenerateContent.");
  },
};

/**
 * Google GenAI (Gemini) Stream Generate Content API Provider (v1beta)
 */
export const geminiStreamProvider: Provider = {
  id: "gemini-stream",
  label: "Gemini Stream (v1beta)",
  routePath: "/v1beta/models/:model\\:streamGenerateContent",
  method: "POST",

  validateRequest(req: Request): ValidationResult {
    const body = req.body;

    if (!body.contents || !Array.isArray(body.contents) || body.contents.length === 0) {
      return {
        valid: false,
        message: "contents is required and must be a non-empty array",
        field: "contents",
      };
    }

    return { valid: true };
  },

  isStreamingRequest(): boolean {
    return true; // This endpoint is always streaming
  },

  formatRateLimitError(): unknown {
    return {
      error: {
        code: 429,
        message: "Resource exhausted. Please try again later.",
        status: "RESOURCE_EXHAUSTED",
      },
    };
  },

  formatValidationError(message: string): unknown {
    return {
      error: {
        code: 400,
        message,
        status: "INVALID_ARGUMENT",
      },
    };
  },

  formatServerError(message = "Internal server error"): unknown {
    return {
      error: {
        code: 500,
        message,
        status: "INTERNAL",
      },
    };
  },

  formatDisabledError(): unknown {
    return {
      error: {
        code: 503,
        message: "This endpoint is currently disabled",
        status: "UNAVAILABLE",
      },
    };
  },

  handleNonStreaming(): unknown {
    throw new Error("Non-streaming not supported on this endpoint. Use generateContent.");
  },

  async handleStreaming(req: Request, res: Response, config: HandlerConfig): Promise<void> {
    const model = req.params.model;
    const body = req.body;
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
    await handleStreaming(model, body, res, serverConfig);
  },
};

/**
 * Google GenAI (Gemini) Generate Content API Provider (v1)
 */
export const geminiGenerateV1Provider: Provider = {
  id: "gemini-generate-v1",
  label: "Gemini Generate (v1)",
  routePath: "/v1/models/:model\\:generateContent",
  method: "POST",

  validateRequest: geminiGenerateProvider.validateRequest,
  isStreamingRequest: geminiGenerateProvider.isStreamingRequest,
  formatRateLimitError: geminiGenerateProvider.formatRateLimitError,
  formatValidationError: geminiGenerateProvider.formatValidationError,
  formatServerError: geminiGenerateProvider.formatServerError,
  formatDisabledError: geminiGenerateProvider.formatDisabledError,
  handleNonStreaming: geminiGenerateProvider.handleNonStreaming,
  handleStreaming: geminiGenerateProvider.handleStreaming,
};

/**
 * Google GenAI (Gemini) Stream Generate Content API Provider (v1)
 */
export const geminiStreamV1Provider: Provider = {
  id: "gemini-stream-v1",
  label: "Gemini Stream (v1)",
  routePath: "/v1/models/:model\\:streamGenerateContent",
  method: "POST",

  validateRequest: geminiStreamProvider.validateRequest,
  isStreamingRequest: geminiStreamProvider.isStreamingRequest,
  formatRateLimitError: geminiStreamProvider.formatRateLimitError,
  formatValidationError: geminiStreamProvider.formatValidationError,
  formatServerError: geminiStreamProvider.formatServerError,
  formatDisabledError: geminiStreamProvider.formatDisabledError,
  handleNonStreaming: geminiStreamProvider.handleNonStreaming,
  handleStreaming: geminiStreamProvider.handleStreaming,
};
