import { EvaluationResult } from "../types";

/**
 * Type guard to check if a value has a score property.
 *
 * @param result - The value to check
 * @returns True if the value is an object with a numeric score property
 *
 * @internal
 */
function resultHasScore(result: unknown): result is { score: number } {
  return (
    typeof result === "object" &&
    result !== null &&
    "score" in result &&
    typeof result.score === "number"
  );
}

/**
 * Type guard to check if a value has a label property.
 *
 * @param result - The value to check
 * @returns True if the value is an object with a string label property
 *
 * @internal
 */
function resultHasLabel(result: unknown): result is { label: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    "label" in result &&
    typeof result.label === "string"
  );
}

/**
 * Type guard to check if a value has an explanation property.
 *
 * @param result - The value to check
 * @returns True if the value is an object with a string explanation property
 *
 * @internal
 */
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
 * Converts an unknown value to an {@link EvaluationResult}.
 *
 * This function provides a flexible way to normalize various return types from
 * evaluator functions into a standardized `EvaluationResult` format. It handles
 * multiple input types:
 *
 * - **Numbers**: Converted to `{ score: number }`
 * - **Strings**: Converted to `{ label: string }`
 * - **Objects**: Extracts `score`, `label`, and `explanation` properties if present
 * - **Other types**: Returns an empty `EvaluationResult` object
 *
 * This is particularly useful when creating evaluators from functions that may
 * return different types, ensuring consistent evaluation result formatting.
 *
 * @param result - The value to convert to an EvaluationResult. Can be:
 *   - A number (converted to score)
 *   - A string (converted to label)
 *   - An object with optional `score`, `label`, and/or `explanation` properties
 *   - Any other value (returns empty object)
 *
 * @returns An {@link EvaluationResult} object with extracted properties
 *
 * @example
 * Convert a number to an EvaluationResult:
 * ```typescript
 * const result = toEvaluationResult(0.95);
 * // Returns: { score: 0.95 }
 * ```
 *
 * @example
 * Convert a string to an EvaluationResult:
 * ```typescript
 * const result = toEvaluationResult("correct");
 * // Returns: { label: "correct" }
 * ```
 *
 * @example
 * Convert an object with all properties:
 * ```typescript
 * const result = toEvaluationResult({
 *   score: 0.9,
 *   label: "high",
 *   explanation: "High quality output"
 * });
 * // Returns: { score: 0.9, label: "high", explanation: "High quality output" }
 * ```
 *
 * @example
 * Convert an object with partial properties:
 * ```typescript
 * const result = toEvaluationResult({ score: 0.8 });
 * // Returns: { score: 0.8 }
 * ```
 *
 * @example
 * Handle null or undefined:
 * ```typescript
 * const result = toEvaluationResult(null);
 * // Returns: {}
 * ```
 *
 * @public
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
