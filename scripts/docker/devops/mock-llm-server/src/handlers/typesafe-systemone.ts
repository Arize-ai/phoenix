import { argmax, generateProbabilities } from "../fake-data.js";
import type {
  TypeSafeBoxResponse,
  TypeSafeChoiceResponse,
  TypeSafeNoulResponse,
  TypeSafeQuestion,
  TypeSafeQuestions,
  TypeSafeScoreResponse,
  TypeSafeSystemOneRequest,
  TypeSafeSystemOneResult,
} from "../types.js";

type Answer =
  | TypeSafeNoulResponse
  | TypeSafeChoiceResponse
  | TypeSafeScoreResponse
  | TypeSafeBoxResponse;

export const TYPESAFE_DEFAULT_MODEL = "jev-latest";

/**
 * Estimate tokens from a JSON-serializable value
 */
function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4);
}

/**
 * Generate a random answer for one question
 */
function generateAnswer(question: TypeSafeQuestion): Answer {
  switch (question.type) {
    case "noul":
      return { type: "noul", noul: Math.random() };

    case "choice": {
      const labels = Object.keys(question.criteria);
      const probabilities = generateProbabilities(labels.length);
      const best = argmax(probabilities);
      return {
        type: "choice",
        choice: labels[best],
        confidence: probabilities[best],
        probabilities: Object.fromEntries(
          labels.map((label, i) => [label, probabilities[i]])
        ),
      };
    }

    case "score": {
      const probabilities = generateProbabilities(question.criteria.length);
      // The score is the expected rubric index, so it can fall between levels
      const score = probabilities.reduce((sum, p, i) => sum + p * i, 0);
      // `unknown` avoids TS2589 on ScoreResponse's recursive legend type.
      return {
        type: "score",
        score,
        confidence: probabilities[argmax(probabilities)],
        legend: Object.fromEntries(
          question.criteria.map((description, i) => [String(i), description])
        ),
        probabilities: Object.fromEntries(
          probabilities.map((p, i) => [String(i), p])
        ),
      } as unknown as TypeSafeScoreResponse;
    }

    case "box": {
      const [top, bottom] = [Math.random(), Math.random()].sort(
        (a, b) => a - b
      );
      const [left, right] = [Math.random(), Math.random()].sort(
        (a, b) => a - b
      );
      return {
        type: "box",
        box: { top, bottom, left, right },
        confidence: Math.random(),
      };
    }
  }
}

/**
 * Handle a TypeSafe System One request. Answers are keyed by question name.
 */
export function handleSystemOne(
  req: TypeSafeSystemOneRequest
): TypeSafeSystemOneResult<TypeSafeQuestions> {
  const answers = Object.fromEntries(
    Object.entries(req.questions).map(([name, question]) => [
      name,
      generateAnswer(question),
    ])
  ) as TypeSafeSystemOneResult<TypeSafeQuestions>["answers"];

  return {
    model: req.model ?? TYPESAFE_DEFAULT_MODEL,
    answers,
    usage: {
      input_tokens: estimateTokens(req.state) + estimateTokens(req.questions),
      output_tokens: Object.keys(req.questions).length,
    },
  };
}
