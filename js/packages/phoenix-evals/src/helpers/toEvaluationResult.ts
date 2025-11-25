import { EvaluationResult } from "../types";

function resultHasScore(result: unknown): result is { score: number } {
  return (
    typeof result === "object" &&
    result !== null &&
    "score" in result &&
    typeof result.score === "number"
  );
}

function resultHasLabel(result: unknown): result is { label: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    "label" in result &&
    typeof result.label === "string"
  );
}

function resultHasExplanation(
  result: unknown
): result is { explanation: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    "explanation" in result &&
    typeof result.explanation === "string"
  );
}

/**
 * A function that takes an unknown result and converts it to an EvaluationResult
 */
export function toEvaluationResult(result: unknown): EvaluationResult {
  if (typeof result === "number") {
    return {
      score: result,
    };
  }
  if (typeof result === "string") {
    return {
      label: result,
    };
  }
  if (typeof result === "object" && result !== null) {
    const evaluationResult: EvaluationResult = {};
    if (resultHasScore(result)) {
      evaluationResult.score = result.score;
    }
    if (resultHasLabel(result)) {
      evaluationResult.label = result.label;
    }
    if (resultHasExplanation(result)) {
      evaluationResult.explanation = result.explanation;
    }
    return evaluationResult;
  }
  return {};
}
