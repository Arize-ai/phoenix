import { z } from "zod";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { getTemplateFormatUtils } from "@phoenix/components/templateEditor/templateEditorUtils";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { isDecisionInstance } from "@phoenix/store/playground/playgroundTask";
import type {
  CanonicalResponseFormat,
  DecisionChoiceOptionDraft,
  DecisionQuestionDraft,
  DecisionQuestionType,
  DecisionRequestDraft,
  DecisionScoreLevelDraft,
  PlaygroundInstance,
} from "@phoenix/store/playground/types";
import { assertUnreachable, isStringKeyedObject } from "@phoenix/typeUtils";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { PlaygroundDecisionOutputMutation$data } from "./__generated__/PlaygroundDecisionOutputMutation.graphql";

/*
 * The playground edits a provider-independent draft and converts at the
 * boundary. The canonical wire shape is TypeSafe System One, which is also
 * what the server validates; OpenAI's Decisions API is a lossless rename of
 * it (predicate ↔ noul, choices array ↔ criteria map, levels ↔ ordered
 * criteria). Span replay reads either shape back into a draft.
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

/** A field left empty; the one error editors hold back until the field is left. */
export const REQUIRED_ERROR = "Required";
const STATE_REQUIRED_ERROR = "State cannot be empty";

export type DecisionQuestionErrors = {
  name?: string;
  instructions?: string;
  /** Too few or too many options. */
  choices?: string;
  /** Per option id: an empty or duplicate value. */
  choiceOptions?: Partial<Record<string, string>>;
  /** Too few or too many levels. */
  levels?: string;
  /** Per level id: an empty description. */
  levelDescriptions?: Partial<Record<string, string>>;
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
    if (!value) optionErrors[option.id] = REQUIRED_ERROR;
    else if (seenValues.has(value)) optionErrors[option.id] = "Duplicate";
    seenValues.add(value);
  }
  if (Object.keys(optionErrors).length) errors.choiceOptions = optionErrors;
  return errors;
}

function getScoreQuestionErrors(
  question: DecisionQuestionDraft
): Pick<DecisionQuestionErrors, "levels" | "levelDescriptions"> {
  const errors: Pick<DecisionQuestionErrors, "levels" | "levelDescriptions"> =
    {};
  const levelCount = question.levels.length;
  if (levelCount < MIN_SCORE_LEVELS) {
    errors.levels = `Add at least ${MIN_SCORE_LEVELS} levels`;
  } else if (levelCount > MAX_SCORE_LEVELS) {
    errors.levels = `At most ${MAX_SCORE_LEVELS} levels`;
  }
  const levelErrors: Partial<Record<string, string>> = {};
  for (const level of question.levels) {
    if (!level.description.trim()) levelErrors[level.id] = REQUIRED_ERROR;
  }
  if (Object.keys(levelErrors).length) errors.levelDescriptions = levelErrors;
  return errors;
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
  if (!name) errors.name = REQUIRED_ERROR;
  else if (seenNames.has(name)) errors.name = "Duplicate name";
  else seenNames.add(name);
  if (!question.instructions.trim()) errors.instructions = REQUIRED_ERROR;
  if (question.type === "choice") {
    Object.assign(errors, getChoiceQuestionErrors(question));
  }
  if (question.type === "score") {
    Object.assign(errors, getScoreQuestionErrors(question));
  }
  return errors;
}

function getStateError(draft: DecisionRequestDraft): string | undefined {
  if (!draft.state.trim()) return STATE_REQUIRED_ERROR;
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
  } else if (draft.questions.length > MAX_DECISION_QUESTIONS) {
    errors.questions = `At most ${MAX_DECISION_QUESTIONS} questions`;
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
    if (questionErrors.levelDescriptions) {
      return `${label}: every level needs a description`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Error visibility
// ---------------------------------------------------------------------------

/**
 * Ids for the fields a draft's errors refer to. Editors record the fields
 * the user has left under these ids; see {@link maskUntouchedErrors}.
 */
export const decisionFieldId = {
  state: () => "state",
  name: (questionId: string) => `${questionId}.name`,
  instructions: (questionId: string) => `${questionId}.instructions`,
  option: (optionId: string) => `option.${optionId}`,
  level: (levelId: string) => `level.${levelId}`,
} as const;

function visibleFieldError({
  message,
  fieldId,
  touched,
}: {
  message: string | undefined;
  fieldId: string;
  touched: ReadonlySet<string>;
}): string | undefined {
  if (message == null) return undefined;
  const isRequired =
    message === REQUIRED_ERROR || message === STATE_REQUIRED_ERROR;
  return !isRequired || touched.has(fieldId) ? message : undefined;
}

function visibleFieldErrors({
  fieldErrors,
  toFieldId,
  touched,
}: {
  fieldErrors: Partial<Record<string, string>> | undefined;
  toFieldId: (id: string) => string;
  touched: ReadonlySet<string>;
}): Partial<Record<string, string>> | undefined {
  if (!fieldErrors) return undefined;
  const visible: Partial<Record<string, string>> = {};
  for (const [id, message] of Object.entries(fieldErrors)) {
    const shown = visibleFieldError({
      message,
      fieldId: toFieldId(id),
      touched,
    });
    if (shown) visible[id] = shown;
  }
  return Object.keys(visible).length ? visible : undefined;
}

/**
 * The errors to show right now. An empty required field is reported only
 * once the user has visited and left it, so a freshly added question,
 * option, or level does not open in an error state; the Run button still
 * refuses an invalid request and names the problem. Every other error
 * (duplicates, counts, malformed JSON) is shown as soon as it exists,
 * since it comes from something the user typed or removed.
 * @param params.errors - the full validation result
 * @param params.touched - ids from {@link decisionFieldId} the user has left
 */
export function maskUntouchedErrors({
  errors,
  touched,
}: {
  errors: DecisionDraftErrors;
  touched: ReadonlySet<string>;
}): DecisionDraftErrors {
  const byQuestionId: DecisionDraftErrors["byQuestionId"] = {};
  for (const [questionId, questionErrors] of Object.entries(
    errors.byQuestionId
  )) {
    if (!questionErrors) continue;
    const visible: DecisionQuestionErrors = {
      name: visibleFieldError({
        message: questionErrors.name,
        fieldId: decisionFieldId.name(questionId),
        touched,
      }),
      instructions: visibleFieldError({
        message: questionErrors.instructions,
        fieldId: decisionFieldId.instructions(questionId),
        touched,
      }),
      choices: questionErrors.choices,
      levels: questionErrors.levels,
      choiceOptions: visibleFieldErrors({
        fieldErrors: questionErrors.choiceOptions,
        toFieldId: decisionFieldId.option,
        touched,
      }),
      levelDescriptions: visibleFieldErrors({
        fieldErrors: questionErrors.levelDescriptions,
        toFieldId: decisionFieldId.level,
        touched,
      }),
    };
    const shown = Object.fromEntries(
      Object.entries(visible).filter(([, value]) => value != null)
    ) as DecisionQuestionErrors;
    if (Object.keys(shown).length) byQuestionId[questionId] = shown;
  }
  return {
    state: visibleFieldError({
      message: errors.state,
      fieldId: decisionFieldId.state(),
      touched,
    }),
    questions: errors.questions,
    byQuestionId,
  };
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
    draft.stateFormat === "json" ? parseJsonState(stateText) : stateText;
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

/** JSON state after variables are filled in, with a cause when it no longer parses. */
function parseJsonState(stateText: string): unknown {
  try {
    return JSON.parse(stateText);
  } catch {
    throw new Error(
      "State is not valid JSON after filling in variables. Quote variable values, or escape quotes inside them."
    );
  }
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

// ---------------------------------------------------------------------------
// Draft → runDecision input
// ---------------------------------------------------------------------------

/** Server template syntaxes for a text state. */
type DecisionTemplateFormat = "MUSTACHE" | "F_STRING";

export type DecisionQuestionInput =
  | {
      predicate: {
        name: string;
        instructions: string;
        criteria: { true: string | null; false: string | null } | null;
      };
    }
  | {
      choice: {
        name: string;
        instructions: string;
        choices: Array<{ value: string; description: string | null }>;
      };
    }
  | {
      scale: {
        name: string;
        instructions: string;
        levels: Array<{ label: string; description: string | null }>;
      };
    };

/** The `runDecision` fields built from a draft; the caller adds the model. */
export type DecisionRunInput = {
  inputs: Array<{ name: string }>;
  state:
    | { object: true }
    | { text: { template: string; templateFormat: DecisionTemplateFormat } };
  inputValues: Record<string, unknown>;
  questions: DecisionQuestionInput[];
};

/** The single input used when the state is sent whole rather than templated. */
const WHOLE_STATE_INPUT = "state";

function toServerTemplateFormat(
  templateFormat: TemplateFormat | undefined
): DecisionTemplateFormat | null {
  if (templateFormat === TemplateFormats.Mustache) return "MUSTACHE";
  if (templateFormat === TemplateFormats.FString) return "F_STRING";
  return null;
}

/** Send `value` as the whole state, through one input rendered on its own. */
function wholeStateInput(value: unknown): Omit<DecisionRunInput, "questions"> {
  return {
    inputs: [{ name: WHOLE_STATE_INPUT }],
    state: {
      text: {
        template: `{{${WHOLE_STATE_INPUT}}}`,
        templateFormat: "MUSTACHE",
      },
    },
    inputValues: { [WHOLE_STATE_INPUT]: value },
  };
}

/**
 * How the state reaches the server. A text state with template variables is
 * sent as a template over those variables, so the server renders it. A JSON
 * object is sent as an object state, one input per key. Anything else (plain
 * text, a JSON array or string, `{}`) is sent whole.
 */
function toStateInput({
  draft,
  templateFormat,
  variables,
  formatText,
}: TemplateOptions & {
  draft: DecisionRequestDraft;
  formatText: TextFormatter;
}): Omit<DecisionRunInput, "questions"> {
  if (draft.stateFormat === "json") {
    const parsed = parseJsonState(formatText(draft.state));
    if (
      isStringKeyedObject(parsed) &&
      !Array.isArray(parsed) &&
      Object.keys(parsed).length > 0
    ) {
      return {
        inputs: Object.keys(parsed).map((name) => ({ name })),
        state: { object: true },
        inputValues: parsed,
      };
    }
    return wholeStateInput(parsed);
  }
  const serverFormat = toServerTemplateFormat(templateFormat);
  const names =
    serverFormat && templateFormat
      ? getTemplateFormatUtils(templateFormat).extractVariables(draft.state)
      : [];
  if (!serverFormat || names.length === 0) {
    return wholeStateInput(draft.state);
  }
  return {
    inputs: names.map((name) => ({ name })),
    state: { text: { template: draft.state, templateFormat: serverFormat } },
    inputValues: Object.fromEntries(
      names.map((name) => [name, variables?.[name] ?? ""])
    ),
  };
}

function optionalText(text: string, formatText: TextFormatter): string | null {
  return text.trim() ? formatText(text) : null;
}

/** One question as the `@oneOf` input `runDecision` takes. */
function toQuestionInput({
  question,
  formatText,
}: {
  question: DecisionQuestionDraft;
  formatText: TextFormatter;
}): DecisionQuestionInput {
  const name = question.name.trim();
  const instructions = formatText(question.instructions);
  switch (question.type) {
    case "choice":
      return {
        choice: {
          name,
          instructions,
          choices: question.choices.map((option) => ({
            value: option.value.trim(),
            description: optionalText(option.description, formatText),
          })),
        },
      };
    case "score":
      return {
        scale: {
          name,
          instructions,
          levels: question.levels.map((level) => ({
            label: formatText(level.description),
            description: null,
          })),
        },
      };
    case "noul": {
      const trueText = optionalText(question.noul.trueDescription, formatText);
      const falseText = optionalText(
        question.noul.falseDescription,
        formatText
      );
      return {
        predicate: {
          name,
          instructions,
          criteria:
            trueText == null && falseText == null
              ? null
              : { true: trueText, false: falseText },
        },
      };
    }
    default:
      return assertUnreachable(question.type);
  }
}

/**
 * The `runDecision` input for a draft, with template variables applied to the
 * question text and passed to the server for the state.
 *
 * Throws on an invalid draft; call {@link validateDecisionDraft} first to
 * show field-level errors.
 */
/** The definition a decision task copies into an experiment over a dataset. */
export type DecisionTaskDefinition = {
  inputs: Array<{ name: string }>;
  state:
    | { input: string }
    | { text: { template: string; templateFormat: DecisionTemplateFormat } };
  questions: DecisionQuestionInput[];
};

function questionVariables({
  draft,
  templateFormat,
}: {
  draft: DecisionRequestDraft;
  templateFormat: TemplateFormat;
}): string[] {
  return extractDecisionVariables({
    draft: { ...draft, state: "" },
    templateFormat,
  });
}

/**
 * Why a draft can't run over a dataset, or null when it can. Each example
 * supplies the state's variables, so the state must be a text template over
 * them; the questions are copied into the experiment as written, so they
 * can't use variables.
 */
export function getDecisionDatasetProblem({
  draft,
  templateFormat,
  purpose = "dataset",
}: {
  draft: DecisionRequestDraft;
  templateFormat: TemplateFormat;
  /**
   * What the definition is for: a dataset run, whose examples fill the
   * inputs, or a saved version, whose callers do.
   */
  purpose?: "dataset" | "save";
}): string | null {
  const when = purpose === "dataset" ? "Over a dataset" : "To save";
  const filler = purpose === "dataset" ? "each example" : "each caller";
  const serverFormat = toServerTemplateFormat(templateFormat);
  if (draft.stateFormat !== "text" || !serverFormat) {
    return `${when}, write the state as text with template variables; a state that is only {{variable}} passes the ${purpose === "dataset" ? "example's" : "caller's"} value as is.`;
  }
  const names = getTemplateFormatUtils(templateFormat).extractVariables(
    draft.state
  );
  if (names.length === 0) {
    return `${when}, the state needs a template variable that ${filler} fills.`;
  }
  const inQuestions = questionVariables({ draft, templateFormat });
  if (inQuestions.length > 0) {
    return `${when}, questions can't use template variables (${inQuestions.join(", ")}); ${filler} gets the same questions.`;
  }
  return null;
}

/**
 * Why the page's instances can't run over a dataset, or null when they can:
 * each decision must be one a dataset can fill (see
 * {@link getDecisionDatasetProblem}).
 */
export function getDecisionDatasetBlockedReason({
  instances,
  templateFormat,
}: {
  instances: ReadonlyArray<
    Pick<PlaygroundInstance, "task" | "decisionRequest">
  >;
  templateFormat: TemplateFormat;
}): string | null {
  // Prompts and decisions may share a run; only a decision has a request the
  // examples must be able to fill.
  for (const [index, instance] of instances.entries()) {
    if (!isDecisionInstance(instance) || !instance.decisionRequest) continue;
    const problem = getDecisionDatasetProblem({
      draft: instance.decisionRequest,
      templateFormat,
    });
    if (problem) {
      return `Instance ${String.fromCharCode("A".charCodeAt(0) + index)}: ${problem}`;
    }
  }
  return null;
}

/** The variable a state template is made of, when it is nothing else. */
function soleStateVariable({
  template,
  templateFormat,
  names,
}: {
  template: string;
  templateFormat: TemplateFormat;
  names: string[];
}): string | null {
  if (names.length !== 1) return null;
  const [name] = names;
  const whole =
    templateFormat === TemplateFormats.FString ? `{${name}}` : `{{${name}}}`;
  return template.trim() === whole ? name : null;
}

/**
 * The decision task's definition for a dataset run: the state's template
 * variables are its inputs, read from each example, and the questions are
 * sent as written. A state that is only one variable passes that input's
 * value as is, so an object in the dataset reaches the model as an object.
 *
 * Throws when {@link getDecisionDatasetProblem} reports a problem.
 */
export function buildDecisionTaskDefinition({
  draft,
  templateFormat,
  purpose = "dataset",
}: {
  draft: DecisionRequestDraft;
  templateFormat: TemplateFormat;
  purpose?: "dataset" | "save";
}): DecisionTaskDefinition {
  const validationError = getDecisionValidationError(draft);
  if (validationError) throw new Error(validationError);
  const problem = getDecisionDatasetProblem({
    draft,
    templateFormat,
    purpose,
  });
  if (problem) throw new Error(problem);
  const serverFormat = toServerTemplateFormat(templateFormat);
  if (!serverFormat) throw new Error("Unsupported template format");
  const names = getTemplateFormatUtils(templateFormat).extractVariables(
    draft.state
  );
  const sole = soleStateVariable({
    template: draft.state,
    templateFormat,
    names,
  });
  const formatText = createTextFormatter({});
  return {
    inputs: names.map((name) => ({ name })),
    state: sole
      ? { input: sole }
      : { text: { template: draft.state, templateFormat: serverFormat } },
    questions: draft.questions.map((question) =>
      toQuestionInput({ question, formatText })
    ),
  };
}

/**
 * Where a decision run goes: a custom provider brings its own endpoint and
 * key, so it takes only its id; a built-in provider takes the instance's
 * endpoint (blank for the provider default) and the browser's credentials.
 */
export function buildDecisionConnection({
  provider,
  baseUrl,
  customProvider,
  credentials,
}: {
  provider: ModelProvider;
  baseUrl?: string | null;
  customProvider?: { id: string } | null;
  credentials: ReadonlyArray<{ envVarName: string; value: string }>;
}) {
  if (customProvider) {
    return { customProvider: { id: customProvider.id } };
  }
  return {
    builtIn: {
      providerKey: provider,
      baseUrl: baseUrl?.trim() || null,
      credentials: [...credentials],
    },
  };
}

export function buildDecisionInput({
  draft,
  templateFormat,
  variables,
}: TemplateOptions & { draft: DecisionRequestDraft }): DecisionRunInput {
  const error = getDecisionValidationError(draft);
  if (error) throw new Error(error);
  const formatText = createTextFormatter({ templateFormat, variables });
  return {
    ...toStateInput({ draft, templateFormat, variables, formatText }),
    questions: draft.questions.map((question) =>
      toQuestionInput({ question, formatText })
    ),
  };
}

// ---------------------------------------------------------------------------
// runDecision result → stored output
// ---------------------------------------------------------------------------

/** The `runDecision` result fields the playground selects. */
export type DecisionRunResult = NonNullable<
  PlaygroundDecisionOutputMutation$data["runDecision"]["result"]
>;

/** One typed answer in the provider response shape the display reads. */
function toOutputAnswer(
  answer: DecisionRunResult["answers"][number]
): Record<string, unknown> {
  switch (answer.__typename) {
    case "PredicateAnswer":
      return { type: "predicate", probability: answer.probability };
    case "ChoiceAnswer":
      return {
        type: "choice",
        choice: answer.choice,
        confidence: answer.confidence,
        probabilities: (answer.choiceProbabilities ?? []).map(
          ({ value, probability }) => ({ value, probability })
        ),
      };
    case "ScaleAnswer":
      return {
        type: "score",
        score: answer.expectedLevel,
        confidence: answer.confidence,
        probabilities: (answer.levelProbabilities ?? []).map(
          ({ level, probability }) => ({ value: level, probability })
        ),
      };
    case "RefusalAnswer":
      return { type: "refusal" };
    default:
      return { type: "unknown" };
  }
}

/**
 * The run's output as stored on the repetition: answers keyed by question
 * name, in the response shape {@link normalizeDecisionResult} reads, so live
 * runs and replayed spans display the same way.
 */
export function toDecisionOutput(result: DecisionRunResult): {
  model: string;
  answers: Record<string, unknown>;
  usage: { input_tokens: number | null; output_tokens: number | null };
} {
  // Null-prototype, as in buildDecisionRequest.
  const answers: Record<string, unknown> = Object.create(null);
  for (const answer of result.answers) {
    answers[answer.name] = toOutputAnswer(answer);
  }
  return {
    model: result.model,
    answers,
    usage: {
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
    },
  };
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
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

/** A schema issue with the field it refers to, for the import error banner. */
function describeImportIssue(issue: z.ZodIssue | undefined): string {
  if (!issue) return "schema mismatch";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

export type DecisionImportResult = {
  draft: DecisionRequestDraft;
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
        `Not a valid OpenAI Decisions request: ${describeImportIssue(parsed.error.issues[0])}`
      );
    }
    return {
      model: parsed.data.model ?? null,
      draft: toDraftFromOpenAIDecisions(parsed.data),
    };
  }
  const parsed = systemOneSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Not a valid System One request: ${describeImportIssue(parsed.error.issues[0])}`
    );
  }
  return {
    model: parsed.data.model ?? null,
    draft: toDraftFromSystemOne(parsed.data),
  };
}

// ---------------------------------------------------------------------------
// Structured output: the questions as a JSON schema an LLM can fill, and a
// chat template that asks an LLM the same questions.
// ---------------------------------------------------------------------------

type JsonSchemaObject = Record<string, unknown>;

export type DecisionJsonSchema = {
  type: "object";
  properties: Record<string, JsonSchemaObject>;
  required: string[];
  additionalProperties: false;
};

/** One line per criterion, for schema descriptions and the system prompt. */
function describeCriteria(question: DecisionQuestionDraft): string[] {
  switch (question.type) {
    case "choice":
      return question.choices.map((option) => {
        const value = option.value.trim();
        const description = option.description.trim();
        return description ? `- ${value}: ${description}` : `- ${value}`;
      });
    case "score":
      return question.levels.map(
        (level, index) => `${index}: ${level.description.trim()}`
      );
    case "noul": {
      const lines: string[] = [];
      const trueDescription = question.noul.trueDescription.trim();
      const falseDescription = question.noul.falseDescription.trim();
      if (trueDescription) lines.push(`True when: ${trueDescription}`);
      if (falseDescription) lines.push(`False when: ${falseDescription}`);
      return lines;
    }
    default:
      return assertUnreachable(question.type);
  }
}

/**
 * The JSON schema for one question's answer: a choice is a string enum, a
 * true/false question a boolean, and a score an integer enum over the level
 * indices (an enum rather than a range, since strict structured-output modes
 * accept enums everywhere). Instructions and criteria become the description.
 */
export function toQuestionJsonSchema(
  question: DecisionQuestionDraft
): JsonSchemaObject {
  const description = [
    question.instructions.trim(),
    ...describeCriteria(question),
  ]
    .filter(Boolean)
    .join("\n");
  const described = description ? { description } : {};
  switch (question.type) {
    case "choice":
      return {
        type: "string",
        enum: question.choices.map((option) => option.value.trim()),
        ...described,
      };
    case "score":
      return {
        type: "integer",
        enum: question.levels.map((_, index) => index),
        ...described,
      };
    case "noul":
      return { type: "boolean", ...described };
    default:
      return assertUnreachable(question.type);
  }
}

/** An object schema with one required property per question, keyed by name. */
export function toDecisionJsonSchema(
  questions: readonly DecisionQuestionDraft[]
): DecisionJsonSchema {
  // Null-prototype, as in buildDecisionRequest, so a question named
  // "__proto__" is a property rather than a prototype assignment.
  const properties: Record<string, JsonSchemaObject> = Object.create(null);
  for (const question of questions) {
    properties[question.name.trim()] = toQuestionJsonSchema(question);
  }
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

export type DecisionChatMessage = {
  role: "system" | "user";
  content: string;
};

/** How to answer one question, as a block of the system message. */
function describeQuestionForPrompt(question: DecisionQuestionDraft): string {
  const lines = [`## ${question.name.trim()}`, question.instructions.trim()];
  switch (question.type) {
    case "choice":
      lines.push(
        "Answer with one of these options:",
        ...describeCriteria(question)
      );
      break;
    case "score":
      lines.push(
        `Answer with a level from 0 to ${question.levels.length - 1}, low to high:`,
        ...describeCriteria(question)
      );
      break;
    case "noul":
      lines.push("Answer true or false.", ...describeCriteria(question));
      break;
    default:
      assertUnreachable(question.type);
  }
  return lines.filter(Boolean).join("\n");
}

/**
 * A chat template that asks an LLM the draft's questions: a system message
 * with the questions and their criteria, a user message carrying the state,
 * and a response format whose schema is {@link toDecisionJsonSchema}.
 * Template variables in the text are kept, so the Inputs panel still applies.
 */
export function buildChatFromDecisionDraft({
  draft,
}: {
  draft: DecisionRequestDraft;
}): {
  messages: DecisionChatMessage[];
  responseFormat: CanonicalResponseFormat;
} {
  const content = [
    "Answer each question about the input. Reply with JSON matching the response format.",
    ...draft.questions.map(describeQuestionForPrompt),
  ].join("\n\n");
  return {
    messages: [
      { role: "system", content },
      { role: "user", content: draft.state },
    ],
    responseFormat: {
      type: "json_schema",
      jsonSchema: {
        name: "decision",
        strict: true,
        schema: toDecisionJsonSchema(draft.questions),
      },
    },
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
    // An experiment run's output: Phoenix's own answer shape.
    case "scale":
      return normalizeScoreAnswer({
        name,
        answer: { ...answer, score: answer.expected_level },
        question,
      });
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
 * @param params.status - the span's status, so a failed call replays as a
 *   failed run rather than an empty one
 */
export function buildDecisionInstanceFromSpanAttributes({
  base,
  spanId,
  attributes,
  status,
}: {
  base: PlaygroundInstance;
  spanId: string;
  attributes: unknown;
  status?: { code: string; message: string };
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
  const output = readAttributeValueText(spanAttributes.output);
  const isFailedRun = status?.code === "ERROR" && output == null;

  return {
    playgroundInstance: {
      ...base,
      // Keep the chat defaults so switching the instance back to an LLM works.
      llmModel: base.model,
      task: { member: "decision" },
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
          output,
          spanId,
          error: isFailedRun
            ? {
                title: "Decision failed",
                message:
                  status?.message || "The recorded decision call failed.",
              }
            : null,
          toolCalls: {},
          status: "finished",
        },
      },
    },
    parsingErrors,
  };
}
