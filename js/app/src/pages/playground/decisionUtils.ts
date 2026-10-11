import { z } from "zod";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { getTemplateFormatUtils } from "@phoenix/components/templateEditor/templateEditorUtils";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import type {
  DecisionChoiceOptionDraft,
  DecisionQuestionDraft,
  DecisionQuestionType,
  DecisionRequestDraft,
  DecisionScoreLevelDraft,
  PlaygroundInstance,
} from "@phoenix/store/playground/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { DecisionWireFormat } from "./__generated__/DecisionExportDialogQuery.graphql";

export type { DecisionWireFormat };

/*
 * The playground edits a provider-independent draft and converts at the
 * boundary. The canonical wire shape is TypeSafe System One, which is also
 * what the server validates; OpenAI's Decisions API is a lossless rename of
 * it (predicate ↔ noul, choices array ↔ criteria map, levels ↔ ordered
 * criteria). Import accepts either shape; export emits the exact body the
 * provider receives, chosen by the wire format the server reports for it.
 */

export type DecisionDraft = DecisionRequestDraft;

/** Limits mirrored from the server's request validation. */
export const MIN_CHOICE_OPTIONS = 2;
export const MAX_CHOICE_OPTIONS = 255;
export const MIN_SCORE_LEVELS = 2;
export const MAX_SCORE_LEVELS = 10;
export const MAX_DECISION_QUESTIONS = 255;

/** A System One request body, the canonical shape the server accepts. */
export type SystemOneRequest = {
  model?: string;
  state: unknown;
  questions: Record<string, SystemOneQuestion>;
};

export type SystemOneQuestion =
  | { type: "choice"; instructions: unknown; criteria: Record<string, unknown> }
  | { type: "score"; instructions: unknown; criteria: unknown[] }
  | {
      type: "noul";
      instructions: unknown;
      criteria?: { true?: unknown; false?: unknown };
    };

/** An OpenAI Decisions API request body. */
export type OpenAIDecisionsRequest = {
  model?: string;
  input: unknown;
  questions: Array<
    | {
        type: "choice";
        name: string;
        instructions: string;
        choices: Array<{ value: string | boolean; description?: string }>;
      }
    | {
        type: "score";
        name: string;
        instructions: string;
        levels: Array<{ label: string; description?: string }>;
      }
    | { type: "predicate"; name: string; instructions: string }
  >;
};

export const DECISION_QUESTION_TYPES: ReadonlyArray<{
  id: DecisionQuestionType;
  label: string;
  description: string;
}> = [
  {
    id: "choice",
    label: "Choice",
    description:
      "Pick one option from a fixed list. Returns a probability per option.",
  },
  {
    id: "noul",
    label: "Noul / Predicate",
    description: "Is a condition true? Returns a probability.",
  },
  {
    id: "score",
    label: "Score",
    description: `Place the state on an ordered scale of ${MIN_SCORE_LEVELS}–${MAX_SCORE_LEVELS} described levels.`,
  },
];

let draftIdCounter = 0;
export function generateDecisionDraftId(): string {
  draftIdCounter += 1;
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `decision-${draftIdCounter}`;
}

export function createChoiceOption({
  value = "",
  description = "",
}: { value?: string; description?: string } = {}): DecisionChoiceOptionDraft {
  return { id: generateDecisionDraftId(), value, description };
}

export function createScoreLevel(description = ""): DecisionScoreLevelDraft {
  return { id: generateDecisionDraftId(), description };
}

/**
 * A new question seeded with a valid, editable starting point, so switching
 * type never opens on a validation error; the user replaces the seeds.
 * @param overrides - fields to set on the new question; `type` defaults to noul
 */
export function createDecisionQuestion({
  type = "noul",
  ...overrides
}: Partial<Omit<DecisionQuestionDraft, "id">> = {}): DecisionQuestionDraft {
  return {
    id: generateDecisionDraftId(),
    type,
    name: "",
    instructions: "",
    choices:
      type === "choice"
        ? [
            createChoiceOption({ value: "yes" }),
            createChoiceOption({ value: "no" }),
          ]
        : [],
    levels:
      type === "score"
        ? [createScoreLevel("Low"), createScoreLevel("High")]
        : [],
    noul: { trueDescription: "", falseDescription: "" },
    ...overrides,
  };
}

/** Starter request: one Choice question over a short support ticket. */
export function createDecisionDraft(): DecisionRequestDraft {
  return {
    state:
      "I was charged twice for my order. Please refund the duplicate payment.",
    stateFormat: "text",
    questions: [
      createDecisionQuestion({
        type: "choice",
        name: "department",
        instructions: "Which department should handle this request?",
        choices: [
          createChoiceOption({
            value: "billing",
            description: "Payments, invoices, and refunds",
          }),
          createChoiceOption({
            value: "technical",
            description: "Problems using the product",
          }),
          createChoiceOption({
            value: "other",
            description: "Requests outside these categories",
          }),
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type DecisionQuestionErrors = {
  name?: string;
  instructions?: string;
  choices?: string;
  choiceOptions?: Partial<Record<string, string>>;
  levels?: string;
};

export type DecisionDraftErrors = {
  state?: string;
  questions?: string;
  byQuestionId: Partial<Record<string, DecisionQuestionErrors>>;
};

function getChoiceQuestionErrors(
  question: DecisionQuestionDraft
): Pick<DecisionQuestionErrors, "choices" | "choiceOptions"> {
  const errors: Pick<DecisionQuestionErrors, "choices" | "choiceOptions"> = {};
  const optionCount = question.choices.length;
  if (optionCount < MIN_CHOICE_OPTIONS) {
    errors.choices = `Add at least ${MIN_CHOICE_OPTIONS} options`;
  } else if (optionCount > MAX_CHOICE_OPTIONS) {
    errors.choices = `At most ${MAX_CHOICE_OPTIONS} options`;
  }
  const seenValues = new Set<string>();
  const optionErrors: Partial<Record<string, string>> = {};
  for (const option of question.choices) {
    const value = option.value.trim();
    if (!value) optionErrors[option.id] = "Required";
    else if (seenValues.has(value)) optionErrors[option.id] = "Duplicate";
    seenValues.add(value);
  }
  if (Object.keys(optionErrors).length) errors.choiceOptions = optionErrors;
  return errors;
}

function getScoreQuestionErrors(
  question: DecisionQuestionDraft
): Pick<DecisionQuestionErrors, "levels"> {
  const levelCount = question.levels.length;
  if (levelCount < MIN_SCORE_LEVELS) {
    return { levels: `Add at least ${MIN_SCORE_LEVELS} levels` };
  }
  if (levelCount > MAX_SCORE_LEVELS) {
    return { levels: `At most ${MAX_SCORE_LEVELS} levels` };
  }
  if (question.levels.some((level) => !level.description.trim())) {
    return { levels: "Every level needs a description" };
  }
  return {};
}

function getQuestionErrors({
  question,
  seenNames,
}: {
  question: DecisionQuestionDraft;
  /** Names already taken by earlier questions; the question's name is added. */
  seenNames: Set<string>;
}): DecisionQuestionErrors {
  const errors: DecisionQuestionErrors = {};
  const name = question.name.trim();
  if (!name) errors.name = "Required";
  else if (seenNames.has(name)) errors.name = "Duplicate name";
  else seenNames.add(name);
  if (!question.instructions.trim()) errors.instructions = "Required";
  if (question.type === "choice") {
    Object.assign(errors, getChoiceQuestionErrors(question));
  }
  if (question.type === "score") {
    Object.assign(errors, getScoreQuestionErrors(question));
  }
  return errors;
}

function getStateError(draft: DecisionRequestDraft): string | undefined {
  if (!draft.state.trim()) return "State cannot be empty";
  if (draft.stateFormat !== "json") return undefined;
  try {
    const parsed: unknown = JSON.parse(draft.state);
    if (
      typeof parsed !== "string" &&
      !Array.isArray(parsed) &&
      !isStringKeyedObject(parsed)
    ) {
      return "JSON state must be a string, object, or array";
    }
  } catch {
    return "State is not valid JSON";
  }
  return undefined;
}

export function validateDecisionDraft(
  draft: DecisionRequestDraft
): DecisionDraftErrors {
  const errors: DecisionDraftErrors = { byQuestionId: {} };
  const stateError = getStateError(draft);
  if (stateError) errors.state = stateError;
  if (draft.questions.length === 0) {
    errors.questions = "Add at least one question";
  }
  const seenNames = new Set<string>();
  for (const question of draft.questions) {
    const questionErrors = getQuestionErrors({ question, seenNames });
    if (Object.keys(questionErrors).length) {
      errors.byQuestionId[question.id] = questionErrors;
    }
  }
  return errors;
}

export function hasDecisionErrors(errors: DecisionDraftErrors): boolean {
  return (
    errors.state != null ||
    errors.questions != null ||
    Object.keys(errors.byQuestionId).length > 0
  );
}

/** The first problem, for the Run button and tests. */
export function getDecisionValidationError(
  draft: DecisionRequestDraft
): string | null {
  const errors = validateDecisionDraft(draft);
  if (errors.state) return errors.state;
  if (errors.questions) return errors.questions;
  for (const question of draft.questions) {
    const questionErrors = errors.byQuestionId[question.id];
    if (!questionErrors) continue;
    const label = question.name.trim() || "question";
    if (questionErrors.name) {
      return questionErrors.name === "Duplicate name"
        ? `Question name: '${label}' is duplicated`
        : `Question name: ${questionErrors.name.toLowerCase()}`;
    }
    if (questionErrors.instructions) {
      return `Instructions for '${label}' are required`;
    }
    if (questionErrors.choices) return `${label}: ${questionErrors.choices}`;
    if (questionErrors.choiceOptions) {
      return `${label}: option values must be unique and non-empty`;
    }
    if (questionErrors.levels) return `${label}: ${questionErrors.levels}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Draft → wire bodies
// ---------------------------------------------------------------------------

type TemplateOptions = {
  /** Template syntax to resolve `variables` with; omit to send text as written. */
  templateFormat?: TemplateFormat;
  /** Values for the template variables in the state and question text. */
  variables?: Record<string, string | undefined>;
};

type TextFormatter = (text: string) => string;

const keepText: TextFormatter = (text) => text;

function createTextFormatter({
  templateFormat,
  variables,
}: TemplateOptions): TextFormatter {
  if (!templateFormat || templateFormat === TemplateFormats.NONE) {
    return keepText;
  }
  const { format } = getTemplateFormatUtils(templateFormat);
  return (text) => format({ text, variables: variables ?? {} });
}

/**
 * Build the canonical System One body from a draft, applying template
 * variables to the state and to every question's instructions.
 *
 * Throws on an invalid draft; call {@link validateDecisionDraft} first to
 * show field-level errors.
 * @param params.draft - the request as edited in the playground
 * @param params.templateFormat - template syntax used by the text fields
 * @param params.variables - values to substitute for template variables
 */
export function buildDecisionRequest({
  draft,
  templateFormat,
  variables,
}: TemplateOptions & { draft: DecisionRequestDraft }): SystemOneRequest {
  const error = getDecisionValidationError(draft);
  if (error) throw new Error(error);
  const formatText = createTextFormatter({ templateFormat, variables });
  const stateText = formatText(draft.state);
  const state: unknown =
    draft.stateFormat === "json" ? JSON.parse(stateText) : stateText;
  // A null-prototype record so a question literally named "__proto__" is an
  // own property rather than a prototype assignment.
  const questions: Record<string, SystemOneQuestion> = Object.create(null);
  for (const question of draft.questions) {
    questions[question.name.trim()] = toSystemOneQuestion({
      question,
      formatText,
    });
  }
  return { state, questions };
}

/**
 * One question in System One shape. Lenient: it never validates, so a card
 * can copy a half-written question.
 * @param params.question - the question draft
 * @param params.formatText - applies template variables; defaults to identity
 */
export function toSystemOneQuestion({
  question,
  formatText = keepText,
}: {
  question: DecisionQuestionDraft;
  formatText?: TextFormatter;
}): SystemOneQuestion {
  const instructions = formatText(question.instructions);
  if (question.type === "choice") {
    const criteria: Record<string, unknown> = {};
    for (const option of question.choices) {
      criteria[option.value.trim()] = option.description.trim()
        ? formatText(option.description)
        : null;
    }
    return { type: "choice", instructions, criteria };
  }
  if (question.type === "score") {
    return {
      type: "score",
      instructions,
      criteria: question.levels.map((level) => formatText(level.description)),
    };
  }
  const trueDescription = question.noul.trueDescription.trim();
  const falseDescription = question.noul.falseDescription.trim();
  const hasCriteria = Boolean(trueDescription || falseDescription);
  return {
    type: "noul",
    instructions,
    ...(hasCriteria
      ? {
          criteria: {
            ...(trueDescription ? { true: formatText(trueDescription) } : {}),
            ...(falseDescription
              ? { false: formatText(falseDescription) }
              : {}),
          },
        }
      : {}),
  };
}

/** The mutation input: the server takes `state` and `questions`. */
export function buildDecisionInput(
  params: TemplateOptions & { draft: DecisionRequestDraft }
): { state: unknown; questions: Record<string, SystemOneQuestion> } {
  const { state, questions } = buildDecisionRequest(params);
  return { state, questions };
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** The body TypeSafe (and any System One-compatible host) receives. */
export function toSystemOneBody({
  request,
  model,
}: {
  request: SystemOneRequest;
  model: string | null | undefined;
}): SystemOneRequest {
  return { model: model ?? undefined, ...request };
}

/**
 * The body OpenAI's `POST /v1/decisions` receives. Mirrors the server-side
 * conversion in `OpenAIDecisionClient.build_request` so the export matches
 * what the trace shows.
 */
export function toOpenAIDecisionsBody({
  request,
  model,
}: {
  request: SystemOneRequest;
  model: string | null | undefined;
}): OpenAIDecisionsRequest {
  const questions: OpenAIDecisionsRequest["questions"] = Object.entries(
    request.questions
  ).map(([name, question]) => {
    const instructions = toText(question.instructions);
    if (question.type === "choice") {
      return {
        type: "choice",
        name,
        instructions,
        choices: Object.entries(question.criteria).map(
          ([value, description]) => ({
            value,
            ...(description != null
              ? { description: toText(description) }
              : {}),
          })
        ),
      };
    }
    if (question.type === "score") {
      return {
        type: "score",
        name,
        instructions,
        levels: question.criteria.map((description, index) => ({
          label: String(index),
          description: toText(description),
        })),
      };
    }
    const criteria = question.criteria;
    const hasCriteria =
      criteria != null && (criteria.true != null || criteria.false != null);
    return {
      type: "predicate",
      name,
      instructions: hasCriteria
        ? `${instructions}\nCriteria: ${JSON.stringify(criteria)}`
        : instructions,
    };
  });
  return {
    model: model ?? undefined,
    input: toText(request.state),
    questions,
  };
}

/**
 * The exact body a provider receives, in the wire format the server reports
 * for it (`GenerativeProvider.decisionWireFormat`).
 */
export function toProviderBody({
  request,
  wireFormat,
  model,
}: {
  request: SystemOneRequest;
  wireFormat: DecisionWireFormat;
  model: string | null | undefined;
}): SystemOneRequest | OpenAIDecisionsRequest {
  return wireFormat === "OPENAI_DECISIONS"
    ? toOpenAIDecisionsBody({ request, model })
    : toSystemOneBody({ request, model });
}

// ---------------------------------------------------------------------------
// Import: wire bodies → draft
// ---------------------------------------------------------------------------

const descriptionSchema = z.union([
  z.string(),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

const systemOneSchema = z.object({
  model: z.string().optional(),
  state: descriptionSchema,
  questions: z.record(
    z.string().min(1),
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("choice"),
        instructions: descriptionSchema,
        criteria: z.record(z.string(), descriptionSchema.nullable()),
      }),
      z.object({
        type: z.literal("score"),
        instructions: descriptionSchema,
        criteria: z.array(descriptionSchema),
      }),
      z.object({
        type: z.literal("noul"),
        instructions: descriptionSchema,
        criteria: z
          .object({
            true: descriptionSchema.optional(),
            false: descriptionSchema.optional(),
          })
          .optional(),
      }),
    ])
  ),
});

const openAIDecisionsSchema = z.object({
  model: z.string().optional(),
  input: z.unknown(),
  questions: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("choice"),
        name: z.string().min(1),
        instructions: z.string(),
        choices: z.array(
          z.object({
            value: z.union([z.string(), z.boolean()]),
            description: z.string().optional(),
          })
        ),
      }),
      z.object({
        type: z.literal("score"),
        name: z.string().min(1),
        instructions: z.string(),
        levels: z.array(
          z.object({ label: z.string(), description: z.string().optional() })
        ),
      }),
      z.object({
        type: z.literal("predicate"),
        name: z.string().min(1),
        instructions: z.string(),
      }),
    ])
  ),
});

export type DecisionImportResult = {
  draft: DecisionRequestDraft;
  format: DecisionWireFormat;
  /** The `model` field of the imported body, if any. */
  model: string | null;
};

function toStateDraft(
  state: unknown
): Pick<DecisionRequestDraft, "state" | "stateFormat"> {
  if (typeof state === "string") return { state, stateFormat: "text" };
  return { state: JSON.stringify(state, null, 2), stateFormat: "json" };
}

type OpenAIDecisionsBody = z.infer<typeof openAIDecisionsSchema>;
type SystemOneBody = z.infer<typeof systemOneSchema>;

function toDraftFromOpenAIDecisions(
  body: OpenAIDecisionsBody
): DecisionRequestDraft {
  const questions = body.questions.map((question): DecisionQuestionDraft => {
    if (question.type === "choice") {
      return createDecisionQuestion({
        type: "choice",
        name: question.name,
        instructions: question.instructions,
        choices: question.choices.map((choice) =>
          createChoiceOption({
            value: String(choice.value),
            description: choice.description ?? "",
          })
        ),
      });
    }
    if (question.type === "score") {
      return createDecisionQuestion({
        type: "score",
        name: question.name,
        instructions: question.instructions,
        levels: question.levels.map((level) =>
          createScoreLevel(level.description ?? level.label)
        ),
      });
    }
    return createDecisionQuestion({
      type: "noul",
      name: question.name,
      instructions: question.instructions,
    });
  });
  return {
    ...(typeof body.input === "string"
      ? { state: body.input, stateFormat: "text" as const }
      : toStateDraft(body.input)),
    questions,
  };
}

function toDraftFromSystemOne(body: SystemOneBody): DecisionRequestDraft {
  const questions = Object.entries(body.questions).map(
    ([name, question]): DecisionQuestionDraft => {
      const instructions = toText(question.instructions);
      if (question.type === "choice") {
        return createDecisionQuestion({
          type: "choice",
          name,
          instructions,
          choices: Object.entries(question.criteria).map(
            ([value, description]) =>
              createChoiceOption({
                value,
                description: description == null ? "" : toText(description),
              })
          ),
        });
      }
      if (question.type === "score") {
        return createDecisionQuestion({
          type: "score",
          name,
          instructions,
          levels: question.criteria.map((description) =>
            createScoreLevel(toText(description))
          ),
        });
      }
      return createDecisionQuestion({
        type: "noul",
        name,
        instructions,
        noul: {
          trueDescription:
            question.criteria?.true != null
              ? toText(question.criteria.true)
              : "",
          falseDescription:
            question.criteria?.false != null
              ? toText(question.criteria.false)
              : "",
        },
      });
    }
  );
  return { ...toStateDraft(body.state), questions };
}

/** Accepts either provider's request body and returns an editable draft. */
export function parseDecisionImport(text: string): DecisionImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Not valid JSON");
  }
  if (!isStringKeyedObject(json)) {
    throw new Error("Expected a JSON object with a request body");
  }
  if (Array.isArray(json.questions) && "input" in json) {
    const parsed = openAIDecisionsSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(
        `Not a valid OpenAI Decisions request: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`
      );
    }
    return {
      format: "OPENAI_DECISIONS",
      model: parsed.data.model ?? null,
      draft: toDraftFromOpenAIDecisions(parsed.data),
    };
  }
  const parsed = systemOneSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Not a valid System One request: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`
    );
  }
  return {
    format: "SYSTEM_ONE",
    model: parsed.data.model ?? null,
    draft: toDraftFromSystemOne(parsed.data),
  };
}

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

/**
 * Every template variable referenced by the request's text fields.
 * @param params.draft - the request to scan
 * @param params.templateFormat - template syntax the fields use
 */
export function extractDecisionVariables({
  draft,
  templateFormat,
}: {
  draft: DecisionRequestDraft | null | undefined;
  templateFormat: TemplateFormat;
}): string[] {
  if (!draft || templateFormat === TemplateFormats.NONE) return [];
  const { extractVariables } = getTemplateFormatUtils(templateFormat);
  const found = new Set<string>();
  const addVariablesFrom = (text: string) =>
    extractVariables(text).forEach((variable) => found.add(variable));
  addVariablesFrom(draft.state);
  for (const question of draft.questions) {
    addVariablesFrom(question.instructions);
    question.choices.forEach((option) => addVariablesFrom(option.description));
    question.levels.forEach((level) => addVariablesFrom(level.description));
    addVariablesFrom(question.noul.trueDescription);
    addVariablesFrom(question.noul.falseDescription);
  }
  return Array.from(found);
}

// ---------------------------------------------------------------------------
// Answers: normalize both providers' responses for display
// ---------------------------------------------------------------------------

export type NormalizedDecisionAnswer =
  | {
      kind: "choice";
      name: string;
      choice: string | null;
      confidence: number | null;
      probabilities: Array<{ value: string; probability: number }>;
    }
  | {
      kind: "score";
      name: string;
      score: number | null;
      confidence: number | null;
      /** One entry per level, in order. */
      levels: Array<{
        index: number;
        label: string;
        probability: number | null;
      }>;
    }
  | { kind: "noul"; name: string; probability: number | null }
  | { kind: "refusal"; name: string }
  | { kind: "unknown"; name: string };

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeChoiceAnswer({
  name,
  answer,
  question,
}: {
  name: string;
  answer: Record<string, unknown>;
  question?: DecisionQuestionDraft;
}): NormalizedDecisionAnswer {
  const probabilities: Array<{ value: string; probability: number }> = [];
  if (Array.isArray(answer.probabilities)) {
    for (const entry of answer.probabilities) {
      if (!isStringKeyedObject(entry)) continue;
      const probability = toFiniteNumber(entry.probability);
      if (probability != null) {
        probabilities.push({ value: String(entry.value), probability });
      }
    }
  } else if (isStringKeyedObject(answer.probabilities)) {
    for (const [value, rawProbability] of Object.entries(
      answer.probabilities
    )) {
      const probability = toFiniteNumber(rawProbability);
      if (probability != null) probabilities.push({ value, probability });
    }
  }
  // Keep the author's option order when we know it.
  if (question?.type === "choice") {
    const orderByValue = new Map(
      question.choices.map((option, index) => [option.value.trim(), index])
    );
    const orderOf = (value: string) =>
      orderByValue.get(value) ?? Number.MAX_SAFE_INTEGER;
    probabilities.sort(
      (left, right) => orderOf(left.value) - orderOf(right.value)
    );
  }
  return {
    kind: "choice",
    name,
    choice: answer.choice == null ? null : String(answer.choice),
    confidence: toFiniteNumber(answer.confidence),
    probabilities,
  };
}

function getScoreLevelLabel({
  index,
  reportedLabel,
  legend,
  question,
}: {
  index: number;
  /** The label the provider sent for this level, if any. */
  reportedLabel: unknown;
  /** The provider's legend of index → label, if any. */
  legend: Record<string, unknown> | null;
  question?: DecisionQuestionDraft;
}): string {
  if (typeof reportedLabel === "string") return reportedLabel;
  const legendLabel = legend?.[String(index)];
  if (typeof legendLabel === "string") return legendLabel;
  return question?.levels[index]?.description ?? String(index);
}

function normalizeScoreAnswer({
  name,
  answer,
  question,
}: {
  name: string;
  answer: Record<string, unknown>;
  question?: DecisionQuestionDraft;
}): NormalizedDecisionAnswer {
  const legend = isStringKeyedObject(answer.legend) ? answer.legend : null;
  const levels: Array<{
    index: number;
    label: string;
    probability: number | null;
  }> = [];
  if (Array.isArray(answer.probabilities)) {
    answer.probabilities.forEach((entry, position) => {
      if (!isStringKeyedObject(entry)) return;
      const index = toFiniteNumber(entry.value) ?? position;
      levels.push({
        index,
        label: getScoreLevelLabel({
          index,
          reportedLabel: entry.label,
          legend,
          question,
        }),
        probability: toFiniteNumber(entry.probability),
      });
    });
  } else if (isStringKeyedObject(answer.probabilities)) {
    for (const [key, rawProbability] of Object.entries(answer.probabilities)) {
      const index = Number(key);
      levels.push({
        index,
        label: getScoreLevelLabel({
          index,
          reportedLabel: undefined,
          legend,
          question,
        }),
        probability: toFiniteNumber(rawProbability),
      });
    }
  } else if (question?.type === "score") {
    question.levels.forEach((level, index) =>
      levels.push({ index, label: level.description, probability: null })
    );
  }
  levels.sort((left, right) => left.index - right.index);
  return {
    kind: "score",
    name,
    score: toFiniteNumber(answer.score),
    confidence: toFiniteNumber(answer.confidence),
    levels,
  };
}

/**
 * One provider answer in display shape.
 * @param params.name - the question name the answer belongs to
 * @param params.answer - the raw provider answer
 * @param params.question - the authored question, for option order and labels
 */
export function normalizeDecisionAnswer({
  name,
  answer,
  question,
}: {
  name: string;
  answer: unknown;
  question?: DecisionQuestionDraft;
}): NormalizedDecisionAnswer {
  if (!isStringKeyedObject(answer)) return { kind: "unknown", name };
  switch (answer.type) {
    case "refusal":
      return { kind: "refusal", name };
    case "choice":
      return normalizeChoiceAnswer({ name, answer, question });
    case "score":
      return normalizeScoreAnswer({ name, answer, question });
    case "noul":
    case "predicate":
      return {
        kind: "noul",
        name,
        probability:
          toFiniteNumber(answer.noul) ?? toFiniteNumber(answer.probability),
      };
    default:
      return { kind: "unknown", name };
  }
}

export type NormalizedDecisionResult = {
  model: string | null;
  answers: NormalizedDecisionAnswer[];
  usage: { input: number | null; output: number | null };
  raw: unknown;
};

/**
 * A provider response in display shape, answers in the authored question order.
 * @param params.result - the raw provider response
 * @param params.draft - the request that produced it, for ordering and labels
 */
export function normalizeDecisionResult({
  result,
  draft,
}: {
  result: unknown;
  draft?: DecisionRequestDraft | null;
}): NormalizedDecisionResult {
  const questionsByName = new Map(
    (draft?.questions ?? []).map(
      (question) => [question.name.trim(), question] as const
    )
  );
  const rawAnswers =
    isStringKeyedObject(result) && isStringKeyedObject(result.answers)
      ? result.answers
      : {};
  const names = new Set<string>([
    ...(draft?.questions.map((question) => question.name.trim()) ?? []),
    ...Object.keys(rawAnswers),
  ]);
  const answers: NormalizedDecisionAnswer[] = [];
  for (const name of names) {
    if (!(name in rawAnswers)) continue;
    answers.push(
      normalizeDecisionAnswer({
        name,
        answer: rawAnswers[name],
        question: questionsByName.get(name),
      })
    );
  }
  const usage =
    isStringKeyedObject(result) && isStringKeyedObject(result.usage)
      ? result.usage
      : {};
  return {
    model:
      isStringKeyedObject(result) && typeof result.model === "string"
        ? result.model
        : null,
    answers,
    usage: {
      input: toFiniteNumber(usage.input_tokens),
      output: toFiniteNumber(usage.output_tokens),
    },
    raw: result,
  };
}

// ---------------------------------------------------------------------------
// Span replay
// ---------------------------------------------------------------------------

/** Whether parsed span attributes describe an OpenInference DECISION span. */
export function isDecisionSpanAttributes(attributes: unknown): boolean {
  if (!isStringKeyedObject(attributes)) return false;
  const openinference = attributes.openinference;
  const kind =
    isStringKeyedObject(openinference) &&
    isStringKeyedObject(openinference.span)
      ? openinference.span.kind
      : undefined;
  return kind === "DECISION" || isStringKeyedObject(attributes.decision);
}

function readStringAttribute(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** A span attribute value as text: strings as-is, anything else re-serialized. */
function readAttributeValueText(container: unknown): string | null {
  const value = isStringKeyedObject(container) ? container.value : undefined;
  if (typeof value === "string") return value;
  return value == null ? null : JSON.stringify(value);
}

/** The provider key and model a decision span was asked to run. */
function readDecisionTarget(decisionAttributes: Record<string, unknown>): {
  provider: ModelProvider | null;
  modelName: string | null;
} {
  const providerName = readStringAttribute(
    decisionAttributes.provider
  )?.toUpperCase();
  const request = isStringKeyedObject(decisionAttributes.request)
    ? decisionAttributes.request
    : {};
  return {
    provider:
      providerName && isModelProvider(providerName) ? providerName : null,
    modelName:
      readStringAttribute(request.model_name) ??
      readStringAttribute(decisionAttributes.model_name),
  };
}

/** The editable request from a span's input body, with a reason when it fails. */
function readDecisionDraft(inputText: string | null): {
  draft: DecisionRequestDraft;
  error: string | null;
} {
  if (inputText == null) {
    return {
      draft: createDecisionDraft(),
      error: "The span has no input body; starting from an example request.",
    };
  }
  try {
    return { draft: parseDecisionImport(inputText).draft, error: null };
  } catch (error) {
    return {
      draft: createDecisionDraft(),
      error: `Could not read the decision request from the span: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Rebuild a decision instance from a DECISION span so the playground opens
 * on the request that produced it. The span's `input.value` is the exact
 * provider body, so the import parser handles both wire formats; the model
 * comes from `decision.request.model_name` and the provider from
 * `decision.provider`, which the server writes as the provider's system name.
 * @param params.base - the default instance to build on
 * @param params.spanId - the span's node id, recorded on the replayed run
 * @param params.attributes - the span's parsed attributes
 */
export function buildDecisionInstanceFromSpanAttributes({
  base,
  spanId,
  attributes,
}: {
  base: PlaygroundInstance;
  spanId: string;
  attributes: unknown;
}): { playgroundInstance: PlaygroundInstance; parsingErrors: string[] } {
  const spanAttributes = isStringKeyedObject(attributes) ? attributes : {};
  const decisionAttributes = isStringKeyedObject(spanAttributes.decision)
    ? spanAttributes.decision
    : {};
  const parsingErrors: string[] = [];

  const { provider, modelName } = readDecisionTarget(decisionAttributes);
  if (!provider) {
    parsingErrors.push(
      "Could not determine the decision provider from the span; pick one from the model menu."
    );
  }
  if (!modelName) {
    parsingErrors.push("Could not determine the decision model from the span.");
  }
  const { draft, error } = readDecisionDraft(
    readAttributeValueText(spanAttributes.input)
  );
  if (error) parsingErrors.push(error);

  return {
    playgroundInstance: {
      ...base,
      // Keep the chat defaults so switching the instance back to an LLM works.
      llmModel: base.model,
      model: {
        provider: provider ?? base.model.provider,
        modelName,
        modelType: "DECISION",
        invocationParameters: base.model.invocationParameters,
        baseUrl: null,
      },
      decisionRequest: draft,
      repetitions: {
        1: {
          output: readAttributeValueText(spanAttributes.output),
          spanId,
          error: null,
          toolCalls: {},
          status: "finished",
        },
      },
    },
    parsingErrors,
  };
}
