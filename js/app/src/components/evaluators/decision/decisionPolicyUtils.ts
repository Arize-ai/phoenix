/**
 * Pure helpers for a decision evaluator's projection policy: the settings that
 * turn a decision judge's answers into annotation labels and scores.
 *
 * The "value" shape used throughout mirrors the GraphQL
 * `DecisionProjectionPolicyInput` (each question is a `@oneOf` of `predicate`,
 * `choice` or `scale`), so a value can be sent to a mutation unchanged.
 */

export type DecisionOptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";

export type DecisionChoiceScoreValue = { choice: string; score: number };

export type DecisionPredicateProjectionValue = {
  name: string;
  threshold: number;
  optimizationDirection: DecisionOptimizationDirection;
};
export type DecisionChoiceProjectionValue = {
  name: string;
  scores: DecisionChoiceScoreValue[];
  optimizationDirection: DecisionOptimizationDirection;
};
export type DecisionScaleProjectionValue = {
  name: string;
  includeLabel: boolean;
  optimizationDirection: DecisionOptimizationDirection;
};

/** One question's settings, in the `DecisionQuestionProjectionInput` shape. */
export type DecisionQuestionProjectionValue =
  | { predicate: DecisionPredicateProjectionValue }
  | { choice: DecisionChoiceProjectionValue }
  | { scale: DecisionScaleProjectionValue };

/** A policy in the `DecisionProjectionPolicyInput` shape. */
export type DecisionProjectionPolicyValue = {
  questions: DecisionQuestionProjectionValue[];
};

/** A decision version question as plain data, in declared order. */
export type DecisionQuestionDefinition =
  | { type: "predicate"; name: string }
  | { type: "choice"; name: string; choices: string[] }
  | { type: "scale"; name: string; levels: string[] };

export const DEFAULT_PREDICATE_THRESHOLD = 0.5;
export const DEFAULT_DECISION_OPTIMIZATION_DIRECTION: DecisionOptimizationDirection =
  "NONE";

/**
 * The GraphQL output shape of a projection policy, as selected through
 * `... on DecisionPredicateProjection` etc. Structural so any Relay fragment
 * selecting these fields is accepted.
 */
export type DecisionProjectionPolicyOutput = {
  readonly questions: ReadonlyArray<{
    readonly __typename: string;
    readonly name?: string;
    readonly optimizationDirection?:
      | DecisionOptimizationDirection
      | "%future added value";
    readonly threshold?: number;
    readonly includeLabel?: boolean;
    readonly scores?: ReadonlyArray<{
      readonly choice: string;
      readonly score: number;
    }>;
  }>;
};

/** The GraphQL output shape of a version's questions. */
export type DecisionVersionQuestionsOutput = ReadonlyArray<{
  readonly __typename: string;
  readonly name?: string;
  readonly choices?: ReadonlyArray<{ readonly value: string }>;
  readonly levels?: ReadonlyArray<{ readonly label: string }>;
}>;

/** The name of a question's settings, whichever variant it is. */
export function getQuestionProjectionName(
  question: DecisionQuestionProjectionValue
): string {
  return getQuestionProjectionSettings(question).name;
}

/** The settings of a question, without the `@oneOf` wrapper. */
export function getQuestionProjectionSettings(
  question: DecisionQuestionProjectionValue
):
  | DecisionPredicateProjectionValue
  | DecisionChoiceProjectionValue
  | DecisionScaleProjectionValue {
  if ("predicate" in question) return question.predicate;
  if ("choice" in question) return question.choice;
  return question.scale;
}

function normalizeDirection(
  direction: string | undefined
): DecisionOptimizationDirection {
  return direction === "MAXIMIZE" || direction === "MINIMIZE"
    ? direction
    : "NONE";
}

/** Converts a version's GraphQL questions to plain question definitions. */
export function toDecisionQuestionDefinitions(
  questions: DecisionVersionQuestionsOutput
): DecisionQuestionDefinition[] {
  const definitions: DecisionQuestionDefinition[] = [];
  for (const question of questions) {
    const name = question.name ?? "";
    switch (question.__typename) {
      case "DecisionPredicateQuestion":
        definitions.push({ type: "predicate", name });
        break;
      case "DecisionChoiceQuestion":
        definitions.push({
          type: "choice",
          name,
          choices: (question.choices ?? []).map((choice) => choice.value),
        });
        break;
      case "DecisionScaleQuestion":
        definitions.push({
          type: "scale",
          name,
          levels: (question.levels ?? []).map((level) => level.label),
        });
        break;
    }
  }
  return definitions;
}

/**
 * Converts a GraphQL output policy (from a fragment) to the input shape.
 * Unknown question variants are dropped.
 */
export function policyOutputToInput(
  policy: DecisionProjectionPolicyOutput | null | undefined
): DecisionProjectionPolicyValue {
  const questions: DecisionQuestionProjectionValue[] = [];
  for (const question of policy?.questions ?? []) {
    const name = question.name ?? "";
    const optimizationDirection = normalizeDirection(
      question.optimizationDirection
    );
    switch (question.__typename) {
      case "DecisionPredicateProjection":
        questions.push({
          predicate: {
            name,
            threshold: question.threshold ?? DEFAULT_PREDICATE_THRESHOLD,
            optimizationDirection,
          },
        });
        break;
      case "DecisionChoiceProjection":
        questions.push({
          choice: {
            name,
            scores: (question.scores ?? []).map(({ choice, score }) => ({
              choice,
              score,
            })),
            optimizationDirection,
          },
        });
        break;
      case "DecisionScaleProjection":
        questions.push({
          scale: {
            name,
            includeLabel: question.includeLabel ?? false,
            optimizationDirection,
          },
        });
        break;
    }
  }
  return { questions };
}

/** Default settings for one question. */
export function defaultQuestionProjection(
  question: DecisionQuestionDefinition
): DecisionQuestionProjectionValue {
  const optimizationDirection = DEFAULT_DECISION_OPTIMIZATION_DIRECTION;
  switch (question.type) {
    case "predicate":
      return {
        predicate: {
          name: question.name,
          threshold: DEFAULT_PREDICATE_THRESHOLD,
          optimizationDirection,
        },
      };
    case "choice":
      return {
        choice: { name: question.name, scores: [], optimizationDirection },
      };
    default:
      return {
        scale: {
          name: question.name,
          includeLabel: false,
          optimizationDirection,
        },
      };
  }
}

/** Default settings for every question of a version, in declared order. */
export function buildDefaultPolicy(
  questions: readonly DecisionQuestionDefinition[]
): DecisionProjectionPolicyValue {
  return { questions: questions.map(defaultQuestionProjection) };
}

function questionKind(
  question: DecisionQuestionProjectionValue
): "predicate" | "choice" | "scale" {
  if ("predicate" in question) return "predicate";
  if ("choice" in question) return "choice";
  return "scale";
}

/**
 * Fits one question's settings to its definition: a setting of another kind
 * is replaced by the default, and choice scores keep declared choice order and
 * drop undeclared choices.
 */
function fitQuestionProjection(
  definition: DecisionQuestionDefinition,
  setting: DecisionQuestionProjectionValue | undefined
): DecisionQuestionProjectionValue {
  if (!setting || questionKind(setting) !== definition.type) {
    return defaultQuestionProjection(definition);
  }
  if (definition.type === "choice" && "choice" in setting) {
    const byChoice = new Map(
      setting.choice.scores.map(({ choice, score }) => [choice, score])
    );
    return {
      choice: {
        ...setting.choice,
        scores: definition.choices.flatMap((choice) =>
          byChoice.has(choice)
            ? [{ choice, score: byChoice.get(choice) as number }]
            : []
        ),
      },
    };
  }
  return setting;
}

/**
 * Fits a policy to a version's questions: one entry per declared question in
 * declared order, defaults for missing ones, unknown ones dropped.
 */
export function normalizePolicy(
  questions: readonly DecisionQuestionDefinition[],
  policy: DecisionProjectionPolicyValue | null | undefined
): DecisionProjectionPolicyValue {
  const byName = new Map(
    (policy?.questions ?? []).map((question) => [
      getQuestionProjectionName(question),
      question,
    ])
  );
  return {
    questions: questions.map((definition) =>
      fitQuestionProjection(definition, byName.get(definition.name))
    ),
  };
}

/**
 * The effective policy: each question the sparse `override` lists replaces the
 * `base` setting for that question and every other question keeps the base's.
 * A null override inherits everything. Order follows `base`; override-only
 * questions are appended.
 */
export function mergePolicyOverride(
  base: DecisionProjectionPolicyValue,
  override: DecisionProjectionPolicyValue | null | undefined
): DecisionProjectionPolicyValue {
  if (!override || override.questions.length === 0) {
    return { questions: [...base.questions] };
  }
  const overrides = new Map(
    override.questions.map((question) => [
      getQuestionProjectionName(question),
      question,
    ])
  );
  const baseNames = new Set(base.questions.map(getQuestionProjectionName));
  return {
    questions: [
      ...base.questions.map(
        (question) =>
          overrides.get(getQuestionProjectionName(question)) ?? question
      ),
      ...override.questions.filter(
        (question) => !baseNames.has(getQuestionProjectionName(question))
      ),
    ],
  };
}

function numbersEqual(a: number, b: number): boolean {
  return Object.is(a, b) || a === b;
}

/** Whether two questions' settings are equal (choice scores by choice). */
export function questionProjectionsEqual(
  a: DecisionQuestionProjectionValue,
  b: DecisionQuestionProjectionValue
): boolean {
  if ("predicate" in a && "predicate" in b) {
    return (
      a.predicate.name === b.predicate.name &&
      numbersEqual(a.predicate.threshold, b.predicate.threshold) &&
      a.predicate.optimizationDirection === b.predicate.optimizationDirection
    );
  }
  if ("scale" in a && "scale" in b) {
    return (
      a.scale.name === b.scale.name &&
      a.scale.includeLabel === b.scale.includeLabel &&
      a.scale.optimizationDirection === b.scale.optimizationDirection
    );
  }
  if ("choice" in a && "choice" in b) {
    if (
      a.choice.name !== b.choice.name ||
      a.choice.optimizationDirection !== b.choice.optimizationDirection ||
      a.choice.scores.length !== b.choice.scores.length
    ) {
      return false;
    }
    const other = new Map(
      b.choice.scores.map(({ choice, score }) => [choice, score])
    );
    return a.choice.scores.every(
      ({ choice, score }) =>
        other.has(choice) && numbersEqual(other.get(choice) as number, score)
    );
  }
  return false;
}

/**
 * The sparse override that turns `base` into `edited`: only the questions whose
 * settings differ. Returns null (inherit everything) when nothing differs.
 */
export function computePolicyOverride(
  base: DecisionProjectionPolicyValue,
  edited: DecisionProjectionPolicyValue
): DecisionProjectionPolicyValue | null {
  const baseByName = new Map(
    base.questions.map((question) => [
      getQuestionProjectionName(question),
      question,
    ])
  );
  const changed = edited.questions.filter((question) => {
    const baseQuestion = baseByName.get(getQuestionProjectionName(question));
    return !baseQuestion || !questionProjectionsEqual(baseQuestion, question);
  });
  return changed.length > 0 ? { questions: changed } : null;
}

/** Validation messages by question name; questions without problems are absent. */
export type DecisionPolicyValidation = Record<string, string[]>;

/**
 * Validates a policy: predicate thresholds must be finite and in [0, 1], choice
 * scores finite and unique per choice, and question names unique.
 */
export function validatePolicy(
  policy: DecisionProjectionPolicyValue
): DecisionPolicyValidation {
  const messages: DecisionPolicyValidation = {};
  const add = (name: string, message: string) => {
    (messages[name] ??= []).push(message);
  };
  const seen = new Set<string>();
  for (const question of policy.questions) {
    const settings = getQuestionProjectionSettings(question);
    if (seen.has(settings.name)) {
      add(settings.name, "Question settings are listed more than once.");
    }
    seen.add(settings.name);
    if ("predicate" in question) {
      const { threshold } = question.predicate;
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
        add(settings.name, "Threshold must be a number from 0 to 1.");
      }
    } else if ("choice" in question) {
      const choices = new Set<string>();
      for (const { choice, score } of question.choice.scores) {
        if (!Number.isFinite(score)) {
          add(settings.name, `Score for "${choice}" must be a finite number.`);
        }
        if (choices.has(choice)) {
          add(settings.name, `Choice "${choice}" is scored more than once.`);
        }
        choices.add(choice);
      }
    }
  }
  return messages;
}

/** Whether a validation result has no messages. */
export function isPolicyValid(validation: DecisionPolicyValidation): boolean {
  return Object.keys(validation).length === 0;
}
