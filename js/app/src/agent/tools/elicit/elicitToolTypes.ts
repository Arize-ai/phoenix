/**
 * Zod schemas are the single source of truth for all elicitation types.
 * TypeScript types are inferred from the schemas, and the schemas are used
 * to parse and validate tool payloads at runtime.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Option schema
// ---------------------------------------------------------------------------

export const elicitationOptionSchema = z.object({
  /** Unique identifier for this option within its question. */
  id: z.string(),
  /** Display text for this option. */
  label: z.string(),
  /** Optional explanation of what this option means. */
  description: z.string().optional(),
});

export type ElicitationOption = z.infer<typeof elicitationOptionSchema>;

// ---------------------------------------------------------------------------
// Question schema
// ---------------------------------------------------------------------------

export const elicitationQuestionSchema = z.object({
  /** Unique identifier for this question. */
  id: z.string(),
  /** The question text shown to the user. */
  prompt: z.string(),
  /**
   * Interaction mode for this question.
   * - `"single"` — radio-style: exactly zero or one selection.
   * - `"multi"` — checkbox-style: zero or more selections.
   * - `"freeform"` — open textarea with no predefined options.
   */
  type: z.enum(["single", "multi", "freeform"]),
  /**
   * Predefined options (required for `single` and `multi`, omitted for
   * `freeform`). Maximum 4 options total (including the implicit freeform
   * option when `allow_freeform` is true).
   */
  options: z.array(elicitationOptionSchema).max(4).optional(),
  /**
   * If true, user can skip this question without selecting any option.
   * Only applies to `single` / `multi` types.
   */
  allow_skip: z.boolean().optional().default(false),
  /**
   * If true, adds a "Type your own answer" option with an inline text input.
   * Only applies to `single` / `multi` types. Counts toward the 4-option
   * limit, so provide at most 3 predefined options when enabled.
   */
  allow_freeform: z.boolean().optional().default(false),
});

export type ElicitationQuestion = z.infer<typeof elicitationQuestionSchema>;

// ---------------------------------------------------------------------------
// Tool input schema
// ---------------------------------------------------------------------------

export const elicitToolInputSchema = z.object({
  /** Ordered list of questions to present to the user. */
  questions: z.array(elicitationQuestionSchema).min(1),
});

export type ElicitToolInput = z.infer<typeof elicitToolInputSchema>;

// ---------------------------------------------------------------------------
// Answer types (output from the carousel, not parsed from the model)
// ---------------------------------------------------------------------------

/**
 * Collected answers keyed by question ID.
 *
 * - For `single` / `multi` questions: `string[]` of selected option IDs.
 *   If `allow_freeform` is enabled and the user typed a custom answer,
 *   the array includes `"__freeform__"` and the text is in
 *   `freeformTexts[questionId]`.
 * - For `freeform` questions: the raw `string` value.
 */
export type ElicitationAnswers = Record<string, string[] | string>;

/**
 * Freeform text values entered by the user for questions with `allow_freeform`.
 * Keyed by question ID.
 */
export type ElicitationFreeformTexts = Record<string, string>;

/**
 * Output shape returned to the model after the user submits answers.
 */
export interface ElicitToolOutput {
  /** The user's answers keyed by question ID. */
  answers: ElicitationAnswers;
  /** Freeform text values for questions with allow_freeform, keyed by question ID. */
  freeformTexts: ElicitationFreeformTexts;
}

// ---------------------------------------------------------------------------
// Pending elicitation (stored in the agent store)
// ---------------------------------------------------------------------------

/**
 * The pending elicitation state stored in the agent store while waiting
 * for the user to respond.
 */
export interface PendingElicitation {
  /** Tool call ID used to route the response back to the AI SDK. */
  toolCallId: string;
  /** Questions to present to the user. */
  questions: ElicitationQuestion[];
}
