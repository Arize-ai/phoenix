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
} from "@phoenix/store/playground/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";

/*
 * The playground edits a provider-independent draft and converts at the
 * boundary. The canonical wire shape is TypeSafe System One, which is also
 * what the server validates; OpenAI's Decisions API is a lossless rename of
 * it (predicate ↔ noul, choices array ↔ criteria map, levels ↔ ordered
 * criteria). Import accepts either shape; export emits the exact body each
 * instance's provider would receive.
 */

export type DecisionDraft = DecisionRequestDraft;

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
    description:
      "Place the state on an ordered scale of 2–10 described levels.",
  },
];

let draftIdCounter = 0;
export function generateDecisionDraftId(): string {
  draftIdCounter += 1;
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `decision-${draftIdCounter}`;
}

export function createChoiceOption(
  value = "",
  description = ""
): DecisionChoiceOptionDraft {
  return { id: generateDecisionDraftId(), value, description };
}

export function createScoreLevel(description = ""): DecisionScoreLevelDraft {
  return { id: generateDecisionDraftId(), description };
}

/**
 * A new question seeded with a valid, editable starting point, so switching
 * type never opens on a validation error; the user replaces the seeds.
 */
export function createDecisionQuestion(
  type: DecisionQuestionType = "noul",
  overrides: Partial<Omit<DecisionQuestionDraft, "id" | "type">> = {}
): DecisionQuestionDraft {
  return {
    id: generateDecisionDraftId(),
    type,
    name: "",
    instructions: "",
    choices:
      type === "choice"
        ? [createChoiceOption("yes"), createChoiceOption("no")]
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
      createDecisionQuestion("choice", {
        name: "department",
        instructions: "Which department should handle this request?",
        choices: [
          createChoiceOption("billing", "Payments, invoices, and refunds"),
          createChoiceOption("technical", "Problems using the product"),
          createChoiceOption("other", "Requests outside these categories"),
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
  choiceOptions?: Record<string, string>;
  levels?: string;
};

export type DecisionDraftErrors = {
  state?: string;
  questions?: string;
  byQuestionId: Record<string, DecisionQuestionErrors>;
};

function validateChoiceQuestion(
  question: DecisionQuestionDraft,
  qErrors: DecisionQuestionErrors
): void {
  const count = question.choices.length;
  if (count < 2) qErrors.choices = "Add at least two options";
  else if (count > 255) qErrors.choices = "At most 255 options";
  const seen = new Set<string>();
  const optionErrors: Record<string, string> = {};
  for (const option of question.choices) {
    const value = option.value.trim();
    if (!value) optionErrors[option.id] = "Required";
    else if (seen.has(value)) optionErrors[option.id] = "Duplicate";
    seen.add(value);
  }
  if (Object.keys(optionErrors).length) qErrors.choiceOptions = optionErrors;
}

function validateScoreQuestion(
  question: DecisionQuestionDraft,
  qErrors: DecisionQuestionErrors
): void {
  const n = question.levels.length;
  if (n < 2) qErrors.levels = "Add at least two levels";
  else if (n > 10) qErrors.levels = "At most 10 levels";
  else if (question.levels.some((level) => !level.description.trim())) {
    qErrors.levels = "Every level needs a description";
  }
}

function validateQuestion(
  question: DecisionQuestionDraft,
  seenNames: Set<string>
): DecisionQuestionErrors {
  const qErrors: DecisionQuestionErrors = {};
  const name = question.name.trim();
  if (!name) qErrors.name = "Required";
  else if (seenNames.has(name)) qErrors.name = "Duplicate name";
  else seenNames.add(name);
  if (!question.instructions.trim()) qErrors.instructions = "Required";
  if (question.type === "choice") validateChoiceQuestion(question, qErrors);
  if (question.type === "score") validateScoreQuestion(question, qErrors);
  return qErrors;
}

function validateState(draft: DecisionRequestDraft): string | undefined {
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
  const stateError = validateState(draft);
  if (stateError) errors.state = stateError;
  if (draft.questions.length === 0) {
    errors.questions = "Add at least one question";
  }
  const seenNames = new Set<string>();
  for (const question of draft.questions) {
    const qErrors = validateQuestion(question, seenNames);
    if (Object.keys(qErrors).length) errors.byQuestionId[question.id] = qErrors;
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
    const q = errors.byQuestionId[question.id];
    if (!q) continue;
    const label = question.name.trim() || "question";
    if (q.name)
      return `Question name: ${q.name === "Duplicate name" ? `'${label}' is duplicated` : q.name.toLowerCase()}`;
    if (q.instructions) return `Instructions for '${label}' are required`;
    if (q.choices) return `${label}: ${q.choices}`;
    if (q.choiceOptions)
      return `${label}: option values must be unique and non-empty`;
    if (q.levels) return `${label}: ${q.levels}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Draft → wire bodies
// ---------------------------------------------------------------------------

type FormatOptions = {
  templateFormat?: TemplateFormat;
  variables?: Record<string, string | undefined>;
};

function makeFormatter({ templateFormat, variables }: FormatOptions) {
  if (!templateFormat || templateFormat === TemplateFormats.NONE) {
    return (text: string) => text;
  }
  const { format } = getTemplateFormatUtils(templateFormat);
  return (text: string) => format({ text, variables: variables ?? {} });
}

/**
 * Build the canonical System One body from a draft, applying template
 * variables to the state and to every question's instructions.
 *
 * Throws on an invalid draft; call {@link validateDecisionDraft} first to
 * show field-level errors.
 */
export function buildDecisionRequest(
  draft: DecisionRequestDraft,
  options: FormatOptions = {}
): SystemOneRequest {
  const error = getDecisionValidationError(draft);
  if (error) throw new Error(error);
  const fmt = makeFormatter(options);
  const stateText = fmt(draft.state);
  const state: unknown =
    draft.stateFormat === "json" ? JSON.parse(stateText) : stateText;
  // A null-prototype record so a question literally named "__proto__" is an
  // own property rather than a prototype assignment.
  const questions: Record<string, SystemOneQuestion> = Object.create(null);
  for (const question of draft.questions) {
    const name = question.name.trim();
    const instructions = fmt(question.instructions);
    if (question.type === "choice") {
      const criteria: Record<string, unknown> = {};
      for (const option of question.choices) {
        criteria[option.value.trim()] = option.description.trim()
          ? fmt(option.description)
          : null;
      }
      questions[name] = { type: "choice", instructions, criteria };
    } else if (question.type === "score") {
      questions[name] = {
        type: "score",
        instructions,
        criteria: question.levels.map((level) => fmt(level.description)),
      };
    } else {
      const t = question.noul.trueDescription.trim();
      const f = question.noul.falseDescription.trim();
      questions[name] = {
        type: "noul",
        instructions,
        ...(t || f
          ? {
              criteria: {
                ...(t ? { true: fmt(t) } : {}),
                ...(f ? { false: fmt(f) } : {}),
              },
            }
          : {}),
      };
    }
  }
  return { state, questions };
}

/** Kept for the mutation input: the server takes `state` and `questions`. */
export function buildDecisionInput(
  draft: DecisionRequestDraft,
  options: FormatOptions = {}
): { state: unknown; questions: Record<string, SystemOneQuestion> } {
  const { state, questions } = buildDecisionRequest(draft, options);
  return { state, questions };
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** The body TypeSafe (and any System One-compatible host) receives. */
export function toSystemOneBody(
  request: SystemOneRequest,
  model: string | null | undefined
): SystemOneRequest {
  return { model: model ?? undefined, ...request };
}

/**
 * The body OpenAI's `POST /v1/decisions` receives. Mirrors the server-side
 * conversion in `OpenAIDecisionClient.build_request` so the export matches
 * what the trace shows.
 */
export function toOpenAIDecisionsBody(
  request: SystemOneRequest,
  model: string | null | undefined
): OpenAIDecisionsRequest {
  const questions: OpenAIDecisionsRequest["questions"] = Object.entries(
    request.questions
  ).map(([name, question]) => {
    const instructions = asText(question.instructions);
    if (question.type === "choice") {
      return {
        type: "choice",
        name,
        instructions,
        choices: Object.entries(question.criteria).map(
          ([value, description]) => ({
            value,
            ...(description != null
              ? { description: asText(description) }
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
          description: asText(description),
        })),
      };
    }
    const criteria = question.criteria;
    return {
      type: "predicate",
      name,
      instructions:
        criteria && (criteria.true != null || criteria.false != null)
          ? `${instructions}\nCriteria: ${JSON.stringify(criteria)}`
          : instructions,
    };
  });
  return {
    model: model ?? undefined,
    input: asText(request.state),
    questions,
  };
}

export type DecisionWireFormat = "systemone" | "openai";

export function getDecisionWireFormat(provider: string): DecisionWireFormat {
  return provider === "OPENAI" ? "openai" : "systemone";
}

export function toProviderBody(
  request: SystemOneRequest,
  provider: string,
  model: string | null | undefined
): SystemOneRequest | OpenAIDecisionsRequest {
  return getDecisionWireFormat(provider) === "openai"
    ? toOpenAIDecisionsBody(request, model)
    : toSystemOneBody(request, model);
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

function stateToDraft(
  state: unknown
): Pick<DecisionRequestDraft, "state" | "stateFormat"> {
  if (typeof state === "string") return { state, stateFormat: "text" };
  return { state: JSON.stringify(state, null, 2), stateFormat: "json" };
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
    const body = parsed.data;
    const inputText = typeof body.input === "string" ? body.input : undefined;
    const questions: DecisionQuestionDraft[] = body.questions.map((q) => {
      if (q.type === "choice") {
        return createDecisionQuestion("choice", {
          name: q.name,
          instructions: q.instructions,
          choices: q.choices.map((c) =>
            createChoiceOption(String(c.value), c.description ?? "")
          ),
        });
      }
      if (q.type === "score") {
        return createDecisionQuestion("score", {
          name: q.name,
          instructions: q.instructions,
          levels: q.levels.map((l) =>
            createScoreLevel(l.description ?? l.label)
          ),
        });
      }
      return createDecisionQuestion("noul", {
        name: q.name,
        instructions: q.instructions,
      });
    });
    return {
      format: "openai",
      model: body.model ?? null,
      draft: {
        ...(inputText != null
          ? { state: inputText, stateFormat: "text" as const }
          : stateToDraft(body.input)),
        questions,
      },
    };
  }
  const parsed = systemOneSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Not a valid System One request: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`
    );
  }
  const body = parsed.data;
  const questions: DecisionQuestionDraft[] = Object.entries(body.questions).map(
    ([name, q]) => {
      const instructions = asText(q.instructions);
      if (q.type === "choice") {
        return createDecisionQuestion("choice", {
          name,
          instructions,
          choices: Object.entries(q.criteria).map(([value, description]) =>
            createChoiceOption(
              value,
              description == null ? "" : asText(description)
            )
          ),
        });
      }
      if (q.type === "score") {
        return createDecisionQuestion("score", {
          name,
          instructions,
          levels: q.criteria.map((d) => createScoreLevel(asText(d))),
        });
      }
      return createDecisionQuestion("noul", {
        name,
        instructions,
        noul: {
          trueDescription:
            q.criteria?.true != null ? asText(q.criteria.true) : "",
          falseDescription:
            q.criteria?.false != null ? asText(q.criteria.false) : "",
        },
      });
    }
  );
  return {
    format: "systemone",
    model: body.model ?? null,
    draft: { ...stateToDraft(body.state), questions },
  };
}

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

/** Every template variable referenced by the request's text fields. */
export function extractDecisionVariables(
  draft: DecisionRequestDraft | null | undefined,
  templateFormat: TemplateFormat
): string[] {
  if (!draft || templateFormat === TemplateFormats.NONE) return [];
  const { extractVariables } = getTemplateFormatUtils(templateFormat);
  const found = new Set<string>();
  const add = (text: string) =>
    extractVariables(text).forEach((v) => found.add(v));
  add(draft.state);
  for (const q of draft.questions) {
    add(q.instructions);
    q.choices.forEach((c) => add(c.description));
    q.levels.forEach((l) => add(l.description));
    add(q.noul.trueDescription);
    add(q.noul.falseDescription);
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

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeChoiceAnswer(
  name: string,
  answer: Record<string, unknown>,
  question?: DecisionQuestionDraft
): NormalizedDecisionAnswer {
  const probabilities: Array<{ value: string; probability: number }> = [];
  if (Array.isArray(answer.probabilities)) {
    for (const p of answer.probabilities) {
      const probability = isStringKeyedObject(p) ? num(p.probability) : null;
      if (isStringKeyedObject(p) && probability != null) {
        probabilities.push({ value: String(p.value), probability });
      }
    }
  } else if (isStringKeyedObject(answer.probabilities)) {
    for (const [value, p] of Object.entries(answer.probabilities)) {
      const probability = num(p);
      if (probability != null) probabilities.push({ value, probability });
    }
  }
  // Keep the author's option order when we know it.
  if (question?.type === "choice") {
    const order = new Map(question.choices.map((c, i) => [c.value.trim(), i]));
    probabilities.sort(
      (a, b) => (order.get(a.value) ?? 1e9) - (order.get(b.value) ?? 1e9)
    );
  }
  return {
    kind: "choice",
    name,
    choice: answer.choice == null ? null : String(answer.choice),
    confidence: num(answer.confidence),
    probabilities,
  };
}

function scoreLevelLabel(
  index: number,
  reported: unknown,
  legend: Record<string, unknown> | null,
  question?: DecisionQuestionDraft
): string {
  if (typeof reported === "string") return reported;
  const legendLabel = legend?.[String(index)];
  if (typeof legendLabel === "string") return legendLabel;
  return question?.levels[index]?.description ?? String(index);
}

function normalizeScoreAnswer(
  name: string,
  answer: Record<string, unknown>,
  question?: DecisionQuestionDraft
): NormalizedDecisionAnswer {
  const legend = isStringKeyedObject(answer.legend) ? answer.legend : null;
  const levels: Array<{
    index: number;
    label: string;
    probability: number | null;
  }> = [];
  if (Array.isArray(answer.probabilities)) {
    answer.probabilities.forEach((p, i) => {
      if (!isStringKeyedObject(p)) return;
      const index = num(p.value) ?? i;
      levels.push({
        index,
        label: scoreLevelLabel(index, p.label, legend, question),
        probability: num(p.probability),
      });
    });
  } else if (isStringKeyedObject(answer.probabilities)) {
    for (const [key, p] of Object.entries(answer.probabilities)) {
      const index = Number(key);
      levels.push({
        index,
        label: scoreLevelLabel(index, undefined, legend, question),
        probability: num(p),
      });
    }
  } else if (question?.type === "score") {
    question.levels.forEach((l, index) =>
      levels.push({ index, label: l.description, probability: null })
    );
  }
  levels.sort((a, b) => a.index - b.index);
  return {
    kind: "score",
    name,
    score: num(answer.score),
    confidence: num(answer.confidence),
    levels,
  };
}

export function normalizeDecisionAnswer(
  name: string,
  answer: unknown,
  question?: DecisionQuestionDraft
): NormalizedDecisionAnswer {
  if (!isStringKeyedObject(answer)) return { kind: "unknown", name };
  switch (answer.type) {
    case "refusal":
      return { kind: "refusal", name };
    case "choice":
      return normalizeChoiceAnswer(name, answer, question);
    case "score":
      return normalizeScoreAnswer(name, answer, question);
    case "noul":
    case "predicate":
      return {
        kind: "noul",
        name,
        probability: num(answer.noul) ?? num(answer.probability),
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

export function normalizeDecisionResult(
  result: unknown,
  draft?: DecisionRequestDraft | null
): NormalizedDecisionResult {
  const byName = new Map(
    (draft?.questions ?? []).map((q) => [q.name.trim(), q] as const)
  );
  const answersRaw =
    isStringKeyedObject(result) && isStringKeyedObject(result.answers)
      ? result.answers
      : {};
  const names = new Set<string>([
    ...(draft?.questions.map((q) => q.name.trim()) ?? []),
    ...Object.keys(answersRaw),
  ]);
  const answers: NormalizedDecisionAnswer[] = [];
  for (const name of names) {
    if (!(name in answersRaw)) continue;
    answers.push(
      normalizeDecisionAnswer(name, answersRaw[name], byName.get(name))
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
    usage: { input: num(usage.input_tokens), output: num(usage.output_tokens) },
    raw: result,
  };
}
