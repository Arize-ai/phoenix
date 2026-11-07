import type {
  DecisionPromptDraft,
  DecisionQuestionDraft,
} from "@phoenix/store/playground/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";

export type OptionProbability = { value: string; probability: number };

/** A choice or yes/no answer's options as they are displayed. */
export type RankedOptions<T = OptionProbability> = {
  /** Most likely first, without options that display as 0%. */
  probabilities: T[];
  /** How many options `probabilities` leaves out. */
  omittedOptionCount: number;
};

export type NormalizedDecisionAnswer =
  | ({
      kind: "choice";
      name: string;
      choice: string | null;
      confidence: number | null;
    } & RankedOptions)
  | ({
      kind: "predicate";
      name: string;
      /** The probability of true. */
      probability: number | null;
      choice: "True" | "False" | null;
    } & RankedOptions)
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
  | { kind: "refusal"; name: string }
  | { kind: "unknown"; name: string };

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Options most likely first, without the ones that display as 0%; the chosen
 * option is always kept. Equally likely options keep their given order.
 * @param params.options - the reported option probabilities
 * @param params.chosen - the option the model picked, if any
 * @param params.optionValues - every option the question defines, for the
 * count of options left out
 */
export function rankOptions<T extends OptionProbability>({
  options,
  chosen,
  optionValues = [],
}: {
  options: readonly T[];
  chosen: string | null | undefined;
  optionValues?: readonly string[];
}): RankedOptions<T> {
  const probabilities = options
    .filter(
      (option) =>
        Math.round(option.probability * 100) > 0 || option.value === chosen
    )
    .sort((left, right) => right.probability - left.probability);
  const optionCount = new Set([
    ...optionValues,
    ...options.map((option) => option.value),
  ]).size;
  return {
    probabilities,
    omittedOptionCount: Math.max(0, optionCount - probabilities.length),
  };
}

/**
 * A yes/no answer as its two options, ranked like a choice's.
 * @param probability - the probability of true
 */
export function rankPredicateOptions(probability: number): {
  choice: "True" | "False";
} & RankedOptions {
  const choice = probability >= 0.5 ? "True" : "False";
  return {
    choice,
    ...rankOptions({
      options: [
        { value: "True", probability },
        { value: "False", probability: 1 - probability },
      ],
      chosen: choice,
    }),
  };
}

/** A note for the options a ranked list leaves out, e.g. "+3 options at 0%". */
export function formatOmittedOptions(count: number): string {
  return `+${count} ${count === 1 ? "option" : "options"} at 0%`;
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
  // Equally likely options keep the author's order when we know it.
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
  const choice = answer.choice == null ? null : String(answer.choice);
  const ranked = rankOptions({
    options: probabilities,
    chosen: choice,
    optionValues:
      question?.type === "choice"
        ? question.choices.map((option) => option.value.trim())
        : [],
  });
  return {
    kind: "choice",
    name,
    choice,
    confidence: toFiniteNumber(answer.confidence),
    probabilities: ranked.probabilities,
    // Without a distribution there is nothing to leave out.
    omittedOptionCount:
      probabilities.length === 0 ? 0 : ranked.omittedOptionCount,
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
    case "predicate": {
      const probability =
        toFiniteNumber(answer.noul) ?? toFiniteNumber(answer.probability);
      return probability == null
        ? {
            kind: "predicate",
            name,
            probability,
            choice: null,
            probabilities: [],
            omittedOptionCount: 0,
          }
        : {
            kind: "predicate",
            name,
            probability,
            ...rankPredicateOptions(probability),
          };
    }
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

/**
 * Answers in display shape, in the order of the questions asked, then any
 * answers to questions not in that list.
 * @param params.answers - answers keyed by question name, or OpenAI's named list
 * @param params.questions - the questions asked, for order, option order and labels
 */
export function normalizeDecisionAnswers({
  answers,
  questions,
}: {
  answers: unknown;
  questions?: readonly DecisionQuestionDraft[];
}): NormalizedDecisionAnswer[] {
  const questionsByName = new Map(
    (questions ?? []).map(
      (question) => [question.name.trim(), question] as const
    )
  );
  const rawAnswers = readAnswersByName(answers);
  const names = new Set<string>([
    ...questionsByName.keys(),
    ...Object.keys(rawAnswers),
  ]);
  const normalized: NormalizedDecisionAnswer[] = [];
  for (const name of names) {
    if (!(name in rawAnswers)) continue;
    normalized.push(
      normalizeDecisionAnswer({
        name,
        answer: rawAnswers[name],
        question: questionsByName.get(name),
      })
    );
  }
  return normalized;
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
  const answers = normalizeDecisionAnswers({
    answers: isStringKeyedObject(result) ? result.answers : undefined,
    questions: draft?.questions,
  });
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

export function formatPercent(value: number | null): string {
  return value == null ? "–" : `${Math.round(value * 100)}%`;
}

/** The level index closest to the expected level, or null without a value or levels. */
export function getNearestLevelIndex({
  expectedLevel,
  levelIndices,
}: {
  expectedLevel: number | null;
  levelIndices: number[];
}): number | null {
  if (expectedLevel == null || levelIndices.length === 0) return null;
  return levelIndices.reduce((nearest, index) =>
    Math.abs(index - expectedLevel) < Math.abs(nearest - expectedLevel)
      ? index
      : nearest
  );
}

function formatDecisionAnswer(answer: NormalizedDecisionAnswer): string {
  switch (answer.kind) {
    case "predicate":
    case "choice":
      if (answer.probabilities.length === 0) return answer.choice ?? "–";
      return [
        ...answer.probabilities.map(
          (entry) => `${entry.value} ${formatPercent(entry.probability)}`
        ),
        ...(answer.omittedOptionCount > 0
          ? [formatOmittedOptions(answer.omittedOptionCount)]
          : []),
      ].join(", ");
    case "scale": {
      if (answer.expectedLevel == null) return "–";
      const nearestIndex = getNearestLevelIndex({
        expectedLevel: answer.expectedLevel,
        levelIndices: answer.levels.map((level) => level.index),
      });
      const nearest = answer.levels.find(
        (level) => level.index === nearestIndex
      );
      const expected = answer.expectedLevel.toFixed(2);
      return nearest ? `${nearest.label} (${expected})` : expected;
    }
    case "refusal":
      return "Refused";
    default:
      return "–";
  }
}

/** Every answer on one line, for a single-line cell. */
export function formatDecisionAnswers(
  answers: readonly NormalizedDecisionAnswer[]
): string {
  return answers
    .map((answer) => `${answer.name}: ${formatDecisionAnswer(answer)}`)
    .join(" · ");
}
