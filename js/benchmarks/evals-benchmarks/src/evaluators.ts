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

/** Boolean-as-1/0 agreement between the predicted label and the ground truth. */
export const accuracy: Evaluator = {
  name: "accuracy",
  kind: "CODE",
  evaluate: ({ output, expected }) => {
    const predicted = (output as { label?: string } | null | undefined)?.label;
    const truth = (expected as { label?: string } | undefined)?.label;
    return predicted === truth ? 1 : 0;
  },
};
