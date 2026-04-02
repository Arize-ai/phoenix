import type { FrontendToolDefinition } from "@phoenix/agent/tools/types";

import type { ElicitToolInput } from "./elicitToolTypes";
import { elicitToolInputSchema } from "./elicitToolTypes";

/**
 * Tool definition for the `ask_user` tool, sent with every agent chat request
 * so the model knows it can ask the user structured questions.
 *
 * The schema matches the `ask_user` input_schema specification: questions are
 * an array of objects with `id`, `prompt`, `type`, optional `options`,
 * `allow_skip`, and `allow_freeform` fields.
 */
export const elicitToolDefinition = {
  name: "ask_user",
  description:
    "Ask the user one or more questions to gather preferences, clarify requirements, or get decisions. Use this when you need user input before proceeding with a task.",
  parameters: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        description: "List of questions to ask the user",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description:
                "Unique identifier for this question (e.g., 'q-format', 'q-count')",
            },
            prompt: {
              type: "string",
              description: "The question text to display to the user",
            },
            type: {
              type: "string",
              enum: ["single", "multi", "freeform"],
              description:
                "single = pick one option, multi = pick multiple options, freeform = open text input",
            },
            options: {
              type: "array",
              description:
                "Available choices (required for single/multi, omit for freeform). Maximum 4 options total—if allow_freeform is true, provide at most 3 options here since freeform counts toward the limit.",
              maxItems: 4,
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    description: "Unique identifier for this option",
                  },
                  label: {
                    type: "string",
                    description: "Display text for this option",
                  },
                  description: {
                    type: "string",
                    description:
                      "Optional explanation of what this option means",
                  },
                },
                required: ["id", "label"],
              },
            },
            allow_skip: {
              type: "boolean",
              default: false,
              description:
                "If true, user can skip this question without selecting any option. Only applies to single/multi types.",
            },
            allow_freeform: {
              type: "boolean",
              default: false,
              description:
                "If true, adds a 'Type your own answer' option. Only applies to single/multi types. Note: counts toward the 4-option limit, so provide at most 3 predefined options when enabled.",
            },
          },
          required: ["id", "prompt", "type"],
        },
      },
    },
    required: ["questions"],
    additionalProperties: false,
  },
} satisfies FrontendToolDefinition;

/**
 * Parses and validates the raw tool input into a typed {@link ElicitToolInput}.
 * Returns `null` if the input is malformed.
 *
 * Uses the {@link elicitToolInputSchema} zod schema for validation, ensuring
 * the parsed data conforms to the expected structure. Also handles
 * JSON-string-encoded `questions` values from transports that serialize arrays.
 */
export function parseElicitToolInput(input: unknown): ElicitToolInput | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  // Some transports serialize the questions array as a JSON string.
  // Pre-process to normalize before handing off to zod.
  const raw = input as Record<string, unknown>;
  let normalized: Record<string, unknown>;
  if (typeof raw.questions === "string") {
    try {
      normalized = { ...raw, questions: JSON.parse(raw.questions) };
    } catch {
      return null;
    }
  } else {
    normalized = raw;
  }

  const result = elicitToolInputSchema.safeParse(normalized);
  if (!result.success) {
    return null;
  }
  return result.data;
}
