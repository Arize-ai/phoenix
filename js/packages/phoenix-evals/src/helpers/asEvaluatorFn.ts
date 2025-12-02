import { AnyFn, EvaluatorFn } from "../types";
import { isPromise } from "../utils/typeUtils";

import { toEvaluationResult } from "./toEvaluationResult";

/**
 * A function that converts a generic function into an evaluator function
 */
export function asEvaluatorFn<RecordType extends Record<string, unknown>>(
  fn: AnyFn
): EvaluatorFn<RecordType> {
  return async (...args) => {
    let result = fn(...args);
    if (isPromise(result)) {
      result = await result;
    }
    return toEvaluationResult(result);
  };
}
