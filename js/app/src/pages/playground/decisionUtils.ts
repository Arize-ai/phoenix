import { jsonLanguage } from "@codemirror/lang-json";
import Mustache from "mustache";
import { z } from "zod";

import {
  type DecisionQuestionTemplate,
  type DecisionStateTemplate,
  isBareWholeTag,
} from "@phoenix/components/decision/decisionTemplates";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { getTemplateFormatUtils } from "@phoenix/components/templateEditor/templateEditorUtils";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import type {
  CanonicalResponseFormat,
  DecisionChoiceOptionDraft,
  DecisionQuestionDraft,
  DecisionQuestionType,
  DecisionPromptDraft,
  DecisionScaleLevelDraft,
  DecisionStateDraft,
  PlaygroundInput,
  PlaygroundInstance,
  PlaygroundNormalizedInstance,
} from "@phoenix/store/playground/types";
import { assertUnreachable, isStringKeyedObject } from "@phoenix/typeUtils";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { PlaygroundDecisionOutputMutation$data } from "./__generated__/PlaygroundDecisionOutputMutation.graphql";

/*
 * The playground edits Phoenix question types: predicate, choice, and scale.
 * Provider adapters translate at import/export boundaries. TypeSafe uses noul
 * and score; OpenAI uses predicate and score. Neither is Phoenix's canonical
 * model. Span replay accepts provider payloads and Phoenix run outputs.
 */

export type DecisionDraft = DecisionPromptDraft;

/** Limits mirrored from the server's request validation. */
export const MIN_CHOICE_OPTIONS = 2;
export const MAX_CHOICE_OPTIONS = 255;
export const MIN_SCALE_LEVELS = 2;
export const MAX_SCALE_LEVELS = 10;
export const MAX_DECISION_QUESTIONS = 255;

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
    id: "predicate",
    label: "Yes / No",
    description: "Is a condition true? Returns a probability.",
  },
  {
    id: "scale",
    label: "Scale",
    description: `Place the state on an ordered scale of ${MIN_SCALE_LEVELS}–${MAX_SCALE_LEVELS} described levels.`,
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

export function createScaleLevel({
  label = "",
  description = "",
}: { label?: string; description?: string } = {}): DecisionScaleLevelDraft {
  return { id: generateDecisionDraftId(), label, description };
}

/**
 * A new question seeded with a valid, editable starting point, so switching
 * type never opens on a validation error; the user replaces the seeds.
 * @param overrides - fields to set on the new question; `type` defaults to predicate
 */
export function createDecisionQuestion({
  type = "predicate",
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
      type === "scale"
        ? [
            createScaleLevel({ label: "Low" }),
            createScaleLevel({ label: "High" }),
          ]
        : [],
    predicate: { trueDescription: "", falseDescription: "" },
    ...overrides,
  };
}

/** A state draft; a mode not given is text, a template not given is empty. */
export function createDecisionStateDraft(
  overrides: Partial<DecisionStateDraft> = {}
): DecisionStateDraft {
  return { mode: "text", text: "", json: "", ...overrides };
}

/** `name` as a template variable in `templateFormat`; empty when it has none. */
export function templateVariable({
  name,
  templateFormat,
}: {
  name: string;
  templateFormat: TemplateFormat;
}) {
  switch (templateFormat) {
    case TemplateFormats.Mustache:
      return `{{${name}}}`;
    case TemplateFormats.FString:
      return `{${name}}`;
    case TemplateFormats.NONE:
      return "";
    default:
      return assertUnreachable(templateFormat);
  }
}

/** A name a template can use as a variable: a letter or `_`, then letters, digits or `_`. */
const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isValidVariableName(name: string): boolean {
  return VARIABLE_NAME_PATTERN.test(name);
}

/**
 * A JSON template of one property per name, each a whole-tag hole for the
 * variable of the same name: `{"ticket": "{{ticket}}"}`. Names that aren't
 * valid variable names are skipped.
 */
export function toJsonTemplateOfVariables({
  names,
  templateFormat,
}: {
  names: readonly string[];
  templateFormat: TemplateFormat;
}): string {
  const entries = names
    .filter(isValidVariableName)
    .map((name) => [name, templateVariable({ name, templateFormat })]);
  return JSON.stringify(Object.fromEntries(entries), null, 2);
}

/**
 * The state with `mode` active. What each mode holds is kept; a mode with
 * nothing in it yet starts from the other's variables: JSON as one hole per
 * variable, text as one `name: variable` line per variable. Without a
 * template format there are no variables, so nothing is seeded.
 */
export function switchDecisionStateMode({
  state,
  mode,
  templateFormat,
}: {
  state: DecisionStateDraft;
  mode: DecisionStateDraft["mode"];
  templateFormat: TemplateFormat;
}): DecisionStateDraft {
  if (state.mode === mode) return state;
  const target = mode === "text" ? state.text : state.json;
  const names =
    target.trim() || templateFormat === TemplateFormats.NONE
      ? []
      : getStateVariables({ state, templateFormat });
  if (names.length === 0) return { ...state, mode };
  if (mode === "json") {
    return {
      ...state,
      mode,
      json: toJsonTemplateOfVariables({ names, templateFormat }),
    };
  }
  return {
    ...state,
    mode,
    text: names
      .map((name) => `${name}: ${templateVariable({ name, templateFormat })}`)
      .join("\n"),
  };
}

/** Starter request: one Choice question over a short support ticket. */
export function createDecisionDraft(): DecisionPromptDraft {
  return {
    state: createDecisionStateDraft({
      text: "I was charged twice for my order. Please refund the duplicate payment.",
    }),
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
  /** Per level id: an empty label. */
  levelLabels?: Partial<Record<string, string>>;
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

function getScaleQuestionErrors(
  question: DecisionQuestionDraft
): Pick<DecisionQuestionErrors, "levels" | "levelLabels"> {
  const errors: Pick<DecisionQuestionErrors, "levels" | "levelLabels"> = {};
  const levelCount = question.levels.length;
  if (levelCount < MIN_SCALE_LEVELS) {
    errors.levels = `Add at least ${MIN_SCALE_LEVELS} levels`;
  } else if (levelCount > MAX_SCALE_LEVELS) {
    errors.levels = `At most ${MAX_SCALE_LEVELS} levels`;
  }
  const levelErrors: Partial<Record<string, string>> = {};
  for (const level of question.levels) {
    if (!level.label.trim()) levelErrors[level.id] = REQUIRED_ERROR;
  }
  if (Object.keys(levelErrors).length) errors.levelLabels = levelErrors;
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
  if (question.type === "scale") {
    Object.assign(errors, getScaleQuestionErrors(question));
  }
  return errors;
}

/** Why a JSON state template can't be sent, or null when it can. */
function getJsonStateError({
  json,
  templateFormat,
}: {
  json: string;
  templateFormat: TemplateFormat;
}): string | undefined {
  if (!json.trim()) return STATE_REQUIRED_ERROR;
  // One bare tag, `{{state}}`, is the whole state.
  if (isBareWholeTag({ templateFormat, json })) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return "The state is not valid JSON";
  }
  if (typeof value === "string") {
    return value.trim() ? undefined : STATE_REQUIRED_ERROR;
  }
  return typeof value === "object" && value !== null
    ? undefined
    : "A JSON state must be an object, a list, or a string";
}

function getStateError({
  draft,
  templateFormat,
}: {
  draft: DecisionPromptDraft;
  templateFormat: TemplateFormat;
}): string | undefined {
  const { state } = draft;
  if (state.mode === "json") {
    return getJsonStateError({ json: state.json, templateFormat });
  }
  return state.text.trim() ? undefined : STATE_REQUIRED_ERROR;
}

export function validateDecisionDraft({
  draft,
  templateFormat,
}: {
  draft: DecisionPromptDraft;
  templateFormat: TemplateFormat;
}): DecisionDraftErrors {
  const errors: DecisionDraftErrors = { byQuestionId: {} };
  const stateError = getStateError({ draft, templateFormat });
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
export function getDecisionValidationError({
  draft,
  templateFormat,
}: {
  draft: DecisionPromptDraft;
  templateFormat: TemplateFormat;
}): string | null {
  const errors = validateDecisionDraft({ draft, templateFormat });
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
    if (questionErrors.levelLabels) {
      return `${label}: every level needs a label`;
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
      levelLabels: visibleFieldErrors({
        fieldErrors: questionErrors.levelLabels,
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
// Draft → templates
// ---------------------------------------------------------------------------

/**
 * The state template a draft sends. Throws when a JSON state isn't valid
 * JSON; {@link validateDecisionDraft} reports that first.
 */
function toDecisionStateTemplate({
  state,
  templateFormat,
}: {
  state: DecisionStateDraft;
  templateFormat: TemplateFormat;
}): DecisionStateTemplate {
  if (state.mode === "text") return { type: "text", template: state.text };
  // A bare tag is stored as the string that is the tag, which reads the same.
  if (isBareWholeTag({ templateFormat, json: state.json })) {
    return { type: "json", template: state.json.trim() };
  }
  try {
    return { type: "json", template: JSON.parse(state.json) };
  } catch {
    throw new Error("The state is not valid JSON");
  }
}

function optionalText(text: string): string | null {
  return text.trim() ? text : null;
}

/** The questions as templates, in the stored shape the rendering rules read. */
function toDecisionQuestionTemplates(
  questions: readonly DecisionQuestionDraft[]
): DecisionQuestionTemplate[] {
  return questions.map((question): DecisionQuestionTemplate => {
    const name = question.name.trim();
    switch (question.type) {
      case "choice":
        return {
          type: "choice",
          name,
          instructions: question.instructions,
          choices: question.choices.map((option) => ({
            value: option.value.trim(),
            description: optionalText(option.description),
          })),
        };
      case "scale":
        return {
          type: "scale",
          name,
          instructions: question.instructions,
          levels: question.levels.map((level) => ({
            label: level.label.trim(),
            description: optionalText(level.description),
          })),
        };
      case "predicate": {
        const trueText = optionalText(question.predicate.trueDescription);
        const falseText = optionalText(question.predicate.falseDescription);
        return {
          type: "predicate",
          name,
          instructions: question.instructions,
          criteria:
            trueText == null && falseText == null
              ? null
              : { true: trueText, false: falseText },
        };
      }
      default:
        return assertUnreachable(question.type);
    }
  });
}

/**
 * The string leaves of a JSON template as written. Valid JSON is read as
 * JSON; JSON being edited is read with the editor's error-tolerant parser,
 * so the variables don't flicker away while a comma is missing.
 */
export function getJsonTemplateStringLeaves({
  json,
  templateFormat,
}: {
  json: string;
  templateFormat: TemplateFormat;
}): string[] {
  if (isBareWholeTag({ templateFormat, json })) return [json.trim()];
  try {
    return collectStringLeaves(JSON.parse(json));
  } catch {
    const leaves: string[] = [];
    jsonLanguage.parser.parse(json).iterate({
      enter: (node) => {
        // Property names are PropertyName nodes; object keys are literal.
        if (node.name !== "String") return;
        try {
          const leaf: unknown = JSON.parse(json.slice(node.from, node.to));
          if (typeof leaf === "string") leaves.push(leaf);
        } catch {
          // An unterminated string has no value yet.
        }
      },
    });
    return leaves;
  }
}

function collectStringLeaves(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStringLeaves);
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(collectStringLeaves);
  }
  return [];
}

/** Root variable names in templates, in first-appearance order; templates that don't parse are skipped. */
function collectVariables({
  templates,
  templateFormat,
}: {
  templates: readonly string[];
  templateFormat: TemplateFormat;
}): string[] {
  const { extractVariables } = getTemplateFormatUtils(templateFormat);
  const names = new Set<string>();
  for (const template of templates) {
    for (const variable of extractVariables(template)) {
      // A path such as `{ticket.id}` or `{items[0]}` names its root, as the
      // server reads it; a conversion or format spec is not part of it.
      names.add(variable.match(/^[^.[!:]+/)?.[0]?.trim() ?? variable);
    }
  }
  return [...names];
}

/** The state's templates: the text, or each string leaf of the JSON. */
function getStateTemplates({
  state,
  templateFormat,
}: {
  state: DecisionStateDraft;
  templateFormat: TemplateFormat;
}): string[] {
  return state.mode === "text"
    ? [state.text]
    : getJsonTemplateStringLeaves({ json: state.json, templateFormat });
}

/** The templated prose of the questions; names, choice values and level labels are not templates. */
function getQuestionTemplates(
  questions: readonly DecisionQuestionDraft[]
): string[] {
  return questions.flatMap((question) => {
    switch (question.type) {
      case "choice":
        return [
          question.instructions,
          ...question.choices.map((option) => option.description),
        ];
      case "scale":
        return [
          question.instructions,
          ...question.levels.map((level) => level.description),
        ];
      case "predicate":
        return [
          question.instructions,
          question.predicate.trueDescription,
          question.predicate.falseDescription,
        ];
      default:
        return assertUnreachable(question.type);
    }
  });
}

/** The variables the state's active mode uses, in first-appearance order. */
function getStateVariables({
  state,
  templateFormat,
}: {
  state: DecisionStateDraft;
  templateFormat: TemplateFormat;
}): string[] {
  return collectVariables({
    templates: getStateTemplates({ state, templateFormat }),
    templateFormat,
  });
}

/**
 * The decision's variables: the root names of the tags in the state and
 * the questions' prose, in first-appearance order, as the server derives
 * them. Templates that don't parse yet are skipped.
 * @param params.draft - the request to scan
 * @param params.templateFormat - the playground's template format
 */
export function extractDecisionVariables({
  draft,
  templateFormat,
}: {
  draft: DecisionPromptDraft | null | undefined;
  templateFormat: TemplateFormat;
}): string[] {
  if (!draft || templateFormat === TemplateFormats.NONE) return [];
  return collectVariables({
    templates: [
      ...getStateTemplates({ state: draft.state, templateFormat }),
      ...getQuestionTemplates(draft.questions),
    ],
    templateFormat,
  });
}

// ---------------------------------------------------------------------------
// Variable values: how a decision reads the Variables pane
// ---------------------------------------------------------------------------

/** What a decision makes of a value typed in the Variables pane. */
export type DecisionVariableReading =
  | { kind: "missing" }
  | {
      kind: "value";
      value: unknown;
      type: "object" | "array" | "number" | "boolean" | "null" | "text";
      /** Whether the text parses as JSON, so reading it as text is a choice. */
      isJson: boolean;
    };

/**
 * A typed value as a decision reads it: text that parses as JSON is that
 * JSON value, unless the variable is read as text; anything else is the
 * text. An empty value is missing, so the call says which variable it lacks;
 * type `""` to send an empty string.
 */
export function readDecisionVariable({
  text,
  isReadAsText = false,
}: {
  text: string | undefined;
  isReadAsText?: boolean;
}): DecisionVariableReading {
  if (text == null || text === "") return { kind: "missing" };
  let parsed: unknown;
  let isJson = false;
  try {
    parsed = JSON.parse(text);
    isJson = true;
  } catch {
    parsed = text;
  }
  if (!isJson || isReadAsText || typeof parsed === "string") {
    return {
      kind: "value",
      value: isReadAsText || !isJson ? text : parsed,
      type: "text",
      isJson,
    };
  }
  const type = Array.isArray(parsed)
    ? "array"
    : parsed === null
      ? "null"
      : typeof parsed === "number"
        ? "number"
        : typeof parsed === "boolean"
          ? "boolean"
          : "object";
  return { kind: "value", value: parsed, type, isJson };
}

/**
 * The values a decision call sends for its variables, read from the
 * Variables pane; a variable with no value is left out, so the call reports
 * it missing.
 */
export function toDecisionVariableValues({
  names,
  input,
}: {
  names: readonly string[];
  input: PlaygroundInput;
}): Record<string, unknown> {
  return Object.fromEntries(
    names.flatMap((name) => {
      const reading = readDecisionVariable({
        text: input.variablesValueCache?.[name],
        isReadAsText: input.variablesReadAsText?.[name] ?? false,
      });
      return reading.kind === "value" ? [[name, reading.value]] : [];
    })
  );
}

// ---------------------------------------------------------------------------
// Draft → runDecision input
// ---------------------------------------------------------------------------

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

/** The state template as the `@oneOf` input the server takes. */
export type DecisionStateInput = { text: string } | { json: unknown };

/** The definition a decision saves, runs and copies into an experiment. */
export type DecisionTaskDefinition = {
  templateFormat: TemplateFormat;
  state: DecisionStateInput;
  questions: DecisionQuestionInput[];
};

/** The `runDecision` fields built from a draft; the caller adds the model. */
export type DecisionRunInput = DecisionTaskDefinition & {
  variables: Record<string, unknown>;
};

/** One question as the `@oneOf` input `runDecision` takes. */
function toQuestionInput(
  question: DecisionQuestionTemplate
): DecisionQuestionInput {
  switch (question.type) {
    case "choice":
      return {
        choice: {
          name: question.name,
          instructions: question.instructions,
          choices: question.choices.map((option) => ({
            value: option.value,
            description: option.description ?? null,
          })),
        },
      };
    case "scale":
      return {
        scale: {
          name: question.name,
          instructions: question.instructions,
          levels: question.levels.map((level) => ({
            label: level.label,
            description: level.description ?? null,
          })),
        },
      };
    case "predicate":
      return {
        predicate: {
          name: question.name,
          instructions: question.instructions,
          criteria: question.criteria
            ? {
                true: question.criteria.true ?? null,
                false: question.criteria.false ?? null,
              }
            : null,
        },
      };
    default:
      return assertUnreachable(question);
  }
}

/**
 * The decision's definition: the template format, the state template and
 * the questions, as saved and sent. Throws on an invalid draft; call
 * {@link validateDecisionDraft} first to show field-level errors.
 */
export function buildDecisionTaskDefinition({
  draft,
  templateFormat,
}: {
  draft: DecisionPromptDraft;
  templateFormat: TemplateFormat;
}): DecisionTaskDefinition {
  const validationError = getDecisionValidationError({ draft, templateFormat });
  if (validationError) throw new Error(validationError);
  const state = toDecisionStateTemplate({ state: draft.state, templateFormat });
  return {
    templateFormat,
    state:
      state.type === "text"
        ? { text: state.template }
        : { json: state.template },
    questions: toDecisionQuestionTemplates(draft.questions).map(
      toQuestionInput
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

/**
 * The `runDecision` input for a draft: its definition and this call's
 * variables. The server renders the templates, so a missing variable is
 * reported by the run.
 * @param params.variables - the call's value for each variable, any JSON
 */
export function buildDecisionInput({
  draft,
  templateFormat,
  variables,
}: {
  draft: DecisionPromptDraft;
  templateFormat: TemplateFormat;
  variables: Record<string, unknown>;
}): DecisionRunInput {
  return {
    ...buildDecisionTaskDefinition({ draft, templateFormat }),
    variables,
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
        probabilities: Object.fromEntries(
          (answer.choiceProbabilities ?? []).map(({ value, probability }) => [
            value,
            probability,
          ])
        ),
      };
    case "ScaleAnswer":
      return {
        type: "scale",
        expected_level: answer.expectedLevel,
        confidence: answer.confidence,
        probabilities: Object.fromEntries(
          (answer.levelProbabilities ?? []).map(({ level, probability }) => [
            level,
            probability,
          ])
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
 * name, in Phoenix's run-output vocabulary (the shape experiment runs store),
 * which {@link normalizeDecisionResult} reads as it reads replayed spans.
 */
export function toDecisionOutput(result: DecisionRunResult): {
  model: string;
  answers: Record<string, unknown>;
  usage: { input_tokens: number | null; output_tokens: number | null };
} {
  // A null-prototype record so an answer literally named "__proto__" is an
  // own property rather than a prototype assignment.
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
  draft: DecisionPromptDraft;
  /** The `model` field of the imported body, if any. */
  model: string | null;
  /**
   * The format to open the request in: Mustache, unless something in it
   * would be read as a tag, in which case nothing is (None), so it is sent
   * exactly as it was.
   */
  templateFormat: TemplateFormat;
};

/**
 * The state draft for an imported state, with no holes: text as Text, an
 * object or a list as JSON, written so it reads back exactly (an own
 * `__proto__` key included).
 */
function toStateDraft(state: unknown): DecisionStateDraft {
  return typeof state === "string"
    ? createDecisionStateDraft({ mode: "text", text: state })
    : createDecisionStateDraft({
        mode: "json",
        json: JSON.stringify(state, null, 2),
      });
}

/** Whether Mustache would read anything in the text as a tag, or can't read it at all. */
function hasMustacheTags(text: string): boolean {
  try {
    return Mustache.parse(text).some(([type]) => type !== "text");
  } catch {
    return true;
  }
}

/**
 * The format an imported or replayed request opens in: Mustache, unless its
 * state or question prose holds something Mustache would read as a tag;
 * then None, so nothing in it is substituted.
 */
export function getImportedTemplateFormat(
  draft: DecisionPromptDraft
): TemplateFormat {
  const templates = [
    ...getStateTemplates({
      state: draft.state,
      templateFormat: TemplateFormats.Mustache,
    }),
    ...getQuestionTemplates(draft.questions),
  ];
  return templates.some(hasMustacheTags)
    ? TemplateFormats.NONE
    : TemplateFormats.Mustache;
}

type OpenAIDecisionsBody = z.infer<typeof openAIDecisionsSchema>;
type SystemOneBody = z.infer<typeof systemOneSchema>;

function toDraftFromOpenAIDecisions(
  body: OpenAIDecisionsBody
): Pick<DecisionImportResult, "draft"> {
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
        type: "scale",
        name: question.name,
        instructions: question.instructions,
        levels: question.levels.map((level) =>
          createScaleLevel({
            label: level.label,
            description: level.description ?? "",
          })
        ),
      });
    }
    return createDecisionQuestion({
      type: "predicate",
      name: question.name,
      instructions: question.instructions,
    });
  });
  return { draft: { state: toStateDraft(body.input), questions } };
}

function toDraftFromSystemOne(
  body: SystemOneBody
): Pick<DecisionImportResult, "draft"> {
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
          type: "scale",
          name,
          instructions,
          levels: question.criteria.map((criteria) =>
            createScaleLevel({ label: toText(criteria) })
          ),
        });
      }
      return createDecisionQuestion({
        type: "predicate",
        name,
        instructions,
        predicate: {
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
  return { draft: { state: toStateDraft(body.state), questions } };
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
    const { draft } = toDraftFromOpenAIDecisions(parsed.data);
    return {
      model: parsed.data.model ?? null,
      draft,
      templateFormat: getImportedTemplateFormat(draft),
    };
  }
  const parsed = systemOneSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Not a valid System One request: ${describeImportIssue(parsed.error.issues[0])}`
    );
  }
  // The schema checks the state's shape, but rebuilding a record drops an
  // own `__proto__` key; send the state exactly as it was written.
  const { draft } = toDraftFromSystemOne({
    ...parsed.data,
    state: json.state as SystemOneBody["state"],
  });
  return {
    model: parsed.data.model ?? null,
    draft,
    templateFormat: getImportedTemplateFormat(draft),
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
    case "scale":
      return question.levels.map((level, index) => {
        const label = level.label.trim();
        const description = level.description.trim();
        return description
          ? `${index}: ${label}: ${description}`
          : `${index}: ${label}`;
      });
    case "predicate": {
      const lines: string[] = [];
      const trueDescription = question.predicate.trueDescription.trim();
      const falseDescription = question.predicate.falseDescription.trim();
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
    case "scale":
      return {
        type: "integer",
        enum: question.levels.map((_, index) => index),
        ...described,
      };
    case "predicate":
      return { type: "boolean", ...described };
    default:
      return assertUnreachable(question.type);
  }
}

/** An object schema with one required property per question, keyed by name. */
export function toDecisionJsonSchema(
  questions: readonly DecisionQuestionDraft[]
): DecisionJsonSchema {
  // Null-prototype, so a question named
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
    case "scale":
      lines.push(
        `Answer with a level from 0 to ${question.levels.length - 1}, low to high:`,
        ...describeCriteria(question)
      );
      break;
    case "predicate":
      lines.push("Answer true or false.", ...describeCriteria(question));
      break;
    default:
      assertUnreachable(question.type);
  }
  return lines.filter(Boolean).join("\n");
}

/** The state as the user message of an LLM prompt: the template as written. */
function chatStateContent(draft: DecisionPromptDraft): string {
  return draft.state.mode === "json" ? draft.state.json : draft.state.text;
}

/**
 * The chat a decision instance becomes when an LLM is picked for it. An
 * instance that kept the messages it had before it became a decision gets
 * them back (null here); one without any, like a new decision, asks the LLM
 * the same questions, as "Duplicate as an LLM prompt" does, rather than
 * becoming an empty prompt.
 */
export function getChatForDecisionToPrompt({
  instance,
  decisionPrompt,
}: {
  instance: Pick<PlaygroundNormalizedInstance, "template">;
  /** The instance's decision prompt. */
  decisionPrompt: DecisionPromptDraft | null | undefined;
}): ReturnType<typeof buildChatFromDecisionDraft> | null {
  const hasMessages =
    instance.template.__type === "chat" &&
    instance.template.messageIds.length > 0;
  if (hasMessages || !decisionPrompt) return null;
  return buildChatFromDecisionDraft({ draft: decisionPrompt });
}

/**
 * A chat template that asks an LLM the draft's questions: a system message
 * with the questions and their criteria, a user message carrying the state,
 * and a response format whose schema is {@link toDecisionJsonSchema}.
 * The state template is kept as written, so its variables still apply.
 */
export function buildChatFromDecisionDraft({
  draft,
}: {
  draft: DecisionPromptDraft;
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
      { role: "user", content: chatStateContent(draft) },
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
      kind: "scale";
      name: string;
      expectedLevel: number | null;
      confidence: number | null;
      /** One entry per level, in order. */
      levels: Array<{
        index: number;
        label: string;
        probability: number | null;
      }>;
    }
  | { kind: "predicate"; name: string; probability: number | null }
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

function getScaleLevelLabel({
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
  const level = question?.levels[index];
  if (!level) return String(index);
  return level.label.trim() || level.description.trim() || String(index);
}

function normalizeScaleAnswer({
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
        label: getScaleLevelLabel({
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
        label: getScaleLevelLabel({
          index,
          reportedLabel: undefined,
          legend,
          question,
        }),
        probability: toFiniteNumber(rawProbability),
      });
    }
  } else if (question?.type === "scale") {
    question.levels.forEach((level, index) =>
      levels.push({
        index,
        label: level.label.trim() || level.description.trim(),
        probability: null,
      })
    );
  }
  levels.sort((left, right) => left.index - right.index);
  return {
    kind: "scale",
    name,
    expectedLevel: toFiniteNumber(answer.score),
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
      return normalizeScaleAnswer({ name, answer, question });
    // An experiment run's output: Phoenix's own answer shape.
    case "scale":
      return normalizeScaleAnswer({
        name,
        answer: { ...answer, score: answer.expected_level },
        question,
      });
    case "noul":
    case "predicate":
      return {
        kind: "predicate",
        name,
        probability:
          toFiniteNumber(answer.noul) ?? toFiniteNumber(answer.probability),
      };
    default:
      return { kind: "unknown", name };
  }
}

/**
 * A response's answers keyed by question name: TypeSafe and Phoenix key them
 * already, while OpenAI's Decisions API lists them with a `name` each.
 */
function readAnswersByName(answers: unknown): Record<string, unknown> {
  if (Array.isArray(answers)) {
    const byName: Record<string, unknown> = Object.create(null);
    for (const answer of answers) {
      if (isStringKeyedObject(answer) && typeof answer.name === "string") {
        byName[answer.name] = answer;
      }
    }
    return byName;
  }
  return isStringKeyedObject(answers) ? answers : {};
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
  draft?: DecisionPromptDraft | null;
}): NormalizedDecisionResult {
  const questionsByName = new Map(
    (draft?.questions ?? []).map(
      (question) => [question.name.trim(), question] as const
    )
  );
  const rawAnswers = readAnswersByName(
    isStringKeyedObject(result) ? result.answers : undefined
  );
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

/** The built-in provider for each `decision.system`, the SDK a span called. */
const PROVIDER_BY_DECISION_SYSTEM: Partial<Record<string, ModelProvider>> = {
  openai: "OPENAI",
  typesafe: "TYPESAFE",
};

/**
 * The provider key and model a decision span was asked to run. A custom
 * provider records its own name as `decision.provider`, so the span's
 * `decision.system` picks the built-in provider of the same SDK, and
 * `customProviderName` says which provider actually ran it.
 */
function readDecisionTarget(decisionAttributes: Record<string, unknown>): {
  provider: ModelProvider | null;
  customProviderName: string | null;
  modelName: string | null;
} {
  const providerName = readStringAttribute(decisionAttributes.provider);
  const providerKey = providerName?.toUpperCase();
  const isBuiltIn = providerKey != null && isModelProvider(providerKey);
  const system = readStringAttribute(decisionAttributes.system)?.toLowerCase();
  const request = isStringKeyedObject(decisionAttributes.request)
    ? decisionAttributes.request
    : {};
  return {
    provider: isBuiltIn
      ? providerKey
      : system
        ? (PROVIDER_BY_DECISION_SYSTEM[system] ?? null)
        : null,
    customProviderName: isBuiltIn ? null : providerName,
    modelName:
      readStringAttribute(request.model_name) ??
      readStringAttribute(decisionAttributes.model_name),
  };
}

/** The editable request from a span's input body, with a reason when it fails. */
function readDecisionDraft(inputText: string | null): {
  draft: DecisionPromptDraft;
  templateFormat: TemplateFormat;
  error: string | null;
} {
  if (inputText == null) {
    return {
      draft: createDecisionDraft(),
      templateFormat: TemplateFormats.Mustache,
      error: "The span has no input body; starting from an example request.",
    };
  }
  try {
    const { draft, templateFormat } = parseDecisionImport(inputText);
    return { draft, templateFormat, error: null };
  } catch (error) {
    return {
      draft: createDecisionDraft(),
      templateFormat: TemplateFormats.Mustache,
      error: `Could not read the decision prompt from the span: ${
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
}): {
  playgroundInstance: PlaygroundInstance;
  parsingErrors: string[];
  templateFormat: TemplateFormat;
} {
  const spanAttributes = isStringKeyedObject(attributes) ? attributes : {};
  const decisionAttributes = isStringKeyedObject(spanAttributes.decision)
    ? spanAttributes.decision
    : {};
  const parsingErrors: string[] = [];

  const { provider, customProviderName, modelName } =
    readDecisionTarget(decisionAttributes);
  if (!provider) {
    parsingErrors.push(
      "Could not determine the decision provider from the span; pick one from the model menu."
    );
  } else if (customProviderName) {
    parsingErrors.push(
      `The span ran on the custom provider "${customProviderName}"; pick it from the model menu to replay it there.`
    );
  }
  if (!modelName) {
    parsingErrors.push("Could not determine the decision model from the span.");
  }
  const { draft, templateFormat, error } = readDecisionDraft(
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
      task: { type: "decision" },
      model: {
        provider: provider ?? base.model.provider,
        modelName,
        modelType: "DECISION",
        invocationParameters: base.model.invocationParameters,
        baseUrl: null,
      },
      decisionPrompt: draft,
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
    // A DECISION span holds the rendered provider payload. It opens with no
    // holes, in a format that reads nothing in it as a tag.
    templateFormat,
  };
}
