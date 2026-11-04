import type { Request } from "express";

import { handleSystemOne } from "../handlers/typesafe-systemone.js";
import type { TypeSafeSystemOneRequest } from "../types.js";
import type { Provider, ValidationResult } from "./types.js";

function invalid(message: string, field: string): ValidationResult {
  return { valid: false, message, field };
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}

/**
 * Validate one named question with the same rules the TypeSafe SDK applies
 */
function validateQuestion(question: unknown, name: string): ValidationResult {
  const field = `questions.${name}`;
  if (!question || typeof question !== "object") {
    return invalid(`${field} must be an object`, field);
  }
  const q = question as Record<string, unknown>;

  switch (q.type) {
    case "noul": {
      const criteria = q.criteria as Record<string, unknown> | null | undefined;
      if (
        !isPresent(q.instructions) &&
        !isPresent(criteria?.true) &&
        !isPresent(criteria?.false)
      ) {
        return invalid(
          `${field} needs instructions or a described outcome`,
          field
        );
      }
      return { valid: true };
    }
    case "choice": {
      const criteria = q.criteria;
      if (
        !criteria ||
        typeof criteria !== "object" ||
        Array.isArray(criteria) ||
        Object.keys(criteria).length === 0
      ) {
        return invalid(
          `${field}.criteria must map at least one label to a description`,
          `${field}.criteria`
        );
      }
      return { valid: true };
    }
    case "score":
      if (!Array.isArray(q.criteria) || q.criteria.length < 2) {
        return invalid(
          `${field}.criteria must list at least 2 descriptions`,
          `${field}.criteria`
        );
      }
      return { valid: true };
    case "box":
      return { valid: true };
    default:
      return invalid(
        `${field}.type must be one of: noul, choice, score, box`,
        `${field}.type`
      );
  }
}

function errorBody(detail: string): unknown {
  return { detail };
}

/**
 * TypeSafe System One API Provider
 */
export const typesafeProvider: Provider = {
  id: "typesafe-systemone",
  label: "TypeSafe System One",
  routePath: "/v1/systemone",
  method: "POST",

  validateRequest(req: Request): ValidationResult {
    const body = (req.body ?? {}) as Partial<TypeSafeSystemOneRequest>;

    if (!isPresent(body.state)) {
      return invalid("state: Field required", "state");
    }
    const questions = body.questions;
    if (
      !questions ||
      typeof questions !== "object" ||
      Array.isArray(questions) ||
      Object.keys(questions).length === 0
    ) {
      return invalid(
        "questions: must contain at least one named question",
        "questions"
      );
    }
    for (const [name, question] of Object.entries(questions)) {
      const result = validateQuestion(question, name);
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
    return errorBody(
      `Rate limit exceeded. Please retry after ${retryAfter} seconds.`
    );
  },

  formatValidationError(message: string): unknown {
    return errorBody(message);
  },

  formatServerError(message = "Internal server error"): unknown {
    return errorBody(message);
  },

  formatAuthenticationError(message = "Invalid API key"): unknown {
    return errorBody(message);
  },

  formatPermissionDeniedError(
    message = "You don't have access to this resource"
  ): unknown {
    return errorBody(message);
  },

  formatDisabledError(): unknown {
    return errorBody("This endpoint is currently disabled");
  },

  handleNonStreaming(req: Request): unknown {
    return handleSystemOne(req.body as TypeSafeSystemOneRequest);
  },

  async handleStreaming(): Promise<void> {
    throw new Error("The System One API does not support streaming");
  },
};
