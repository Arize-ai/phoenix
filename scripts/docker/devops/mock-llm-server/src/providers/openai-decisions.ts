import type { Request } from "express";

import { handleDecision } from "../handlers/openai-decisions.js";
import type { OpenAIDecisionCreateParams } from "../types.js";
import type { Provider, ValidationResult } from "./types.js";

const QUESTION_TYPES = new Set(["predicate", "choice", "score"]);

function invalid(message: string, field: string): ValidationResult {
  return { valid: false, message, field };
}

/**
 * Validate one question against the documented request limits
 */
function validateQuestion(question: unknown, i: number): ValidationResult {
  const field = `questions[${i}]`;
  if (!question || typeof question !== "object") {
    return invalid(`${field} must be an object`, field);
  }
  const q = question as Record<string, unknown>;

  if (typeof q.type !== "string" || !QUESTION_TYPES.has(q.type)) {
    return invalid(
      `${field}.type must be one of: predicate, choice, score`,
      `${field}.type`
    );
  }
  if (q.instructions === undefined || q.instructions === null) {
    return invalid(
      `Missing required parameter: ${field}.instructions`,
      `${field}.instructions`
    );
  }

  if (q.type === "choice") {
    const choices = q.choices;
    if (!Array.isArray(choices) || choices.length < 2 || choices.length > 255) {
      return invalid(
        `${field}.choices must contain between 2 and 255 choices`,
        `${field}.choices`
      );
    }
    // Choice values are typed: "true" and true are distinct
    const seen = new Set<string>();
    for (const choice of choices as Array<{ value?: unknown }>) {
      const value = choice?.value;
      if (typeof value !== "string" && typeof value !== "boolean") {
        return invalid(
          `${field}.choices[].value must be a string or boolean`,
          `${field}.choices`
        );
      }
      const key = `${typeof value}:${value}`;
      if (seen.has(key)) {
        return invalid(`${field}.choices must be unique`, `${field}.choices`);
      }
      seen.add(key);
    }
  }

  if (q.type === "score") {
    const levels = q.levels;
    if (!Array.isArray(levels) || levels.length < 2) {
      return invalid(
        `${field}.levels must contain at least 2 levels`,
        `${field}.levels`
      );
    }
    if (
      (levels as Array<{ label?: unknown }>).some(
        (level) => typeof level?.label !== "string"
      )
    ) {
      return invalid(
        `${field}.levels[].label must be a string`,
        `${field}.levels`
      );
    }
  }

  return { valid: true };
}

/**
 * OpenAI Decisions API Provider
 */
export const openaiDecisionsProvider: Provider = {
  id: "openai-decisions",
  label: "OpenAI Decisions",
  routePath: "/v1/decisions",
  method: "POST",

  validateRequest(req: Request): ValidationResult {
    const body = (req.body ?? {}) as Partial<OpenAIDecisionCreateParams>;

    if (!body.model) {
      return invalid("Missing required parameter: model", "model");
    }
    if (body.input === undefined || body.input === null) {
      return invalid("Missing required parameter: input", "input");
    }
    if (
      !Array.isArray(body.questions) ||
      body.questions.length < 1 ||
      body.questions.length > 400
    ) {
      return invalid(
        "questions must contain between 1 and 400 questions",
        "questions"
      );
    }
    for (const [i, question] of body.questions.entries()) {
      const result = validateQuestion(question, i);
      if (!result.valid) {
        return result;
      }
    }

    return { valid: true };
  },

  isStreamingRequest(): boolean {
    return false;
  },

  formatRateLimitError(retryAfter: number): unknown {
    return {
      error: {
        message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
        type: "rate_limit_error",
        code: "rate_limit_exceeded",
        param: null,
      },
    };
  },

  formatValidationError(message: string, field?: string): unknown {
    return {
      error: {
        message,
        type: "invalid_request_error",
        code: "invalid_request",
        param: field ?? null,
      },
    };
  },

  formatServerError(message = "Internal server error"): unknown {
    return {
      error: { message, type: "server_error", code: null, param: null },
    };
  },

  formatAuthenticationError(message = "Incorrect API key provided"): unknown {
    return {
      error: {
        message,
        type: "invalid_request_error",
        code: "invalid_api_key",
        param: null,
      },
    };
  },

  formatPermissionDeniedError(
    message = "You don't have access to this resource"
  ): unknown {
    return {
      error: {
        message,
        type: "insufficient_quota",
        code: "insufficient_quota",
        param: null,
      },
    };
  },

  formatDisabledError(): unknown {
    return {
      error: {
        message: "This endpoint is currently disabled",
        type: "service_unavailable",
        code: null,
        param: null,
      },
    };
  },

  handleNonStreaming(req: Request): unknown {
    return handleDecision(req.body as OpenAIDecisionCreateParams);
  },

  async handleStreaming(): Promise<void> {
    throw new Error("The Decisions API does not support streaming");
  },
};
