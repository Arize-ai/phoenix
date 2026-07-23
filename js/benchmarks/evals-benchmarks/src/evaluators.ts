/**
 * Shared evaluators for the eval benchmarks.
 *
 * Every benchmark runs a Phoenix evaluator-under-test as the task and records
 * its result as the run output via `px.logOutput(result)` — a
 * `{ label, score, explanation }` object. Each example's `expected` carries the
 * ground-truth `{ label }`. The `accuracy` evaluator below scores whether the
 * evaluator-under-test predicted the ground-truth label, so the suite measures
 * the *evaluator's* accuracy rather than any model output.
 */
import type { Evaluator } from "@arizeai/phoenix-client/vitest";

/** Extracts the `label` property when the value is an object carrying one. */
const getLabel = (value: unknown): unknown => {
  if (typeof value === "object" && value !== null && "label" in value) {
    return value.label;
  }
  return undefined;
};

/** Boolean-as-1/0 agreement between the predicted label and the ground truth. */
export const accuracy: Evaluator = {
  name: "accuracy",
  kind: "CODE",
  evaluate: ({ output, expected }) => {
    const predicted = getLabel(output);
    const truth = getLabel(expected);
    return predicted === truth ? 1 : 0;
  },
};
