import type { LLMEvaluator } from "@arizeai/phoenix-evals";

import { Evaluator } from "../../types/experiments";

import { asExperimentEvaluator } from "./asExperimentEvaluator";

/**
 * A function that acts as a bridge, converting phoenix-evals to be experiment evaluator compatible
 * @param phoenixEvaluator
 * @returns an experiment compatible Evaluator
 */
export function fromPhoenixLLMEvaluator<
  RecordType extends Record<string, unknown>,
>(phoenixLLMEvaluator: LLMEvaluator<RecordType>): Evaluator {
  return asExperimentEvaluator({
    name: phoenixLLMEvaluator.name,
    kind: "LLM",
    evaluate: async (example) => {
      // For now blindly coerce the types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await phoenixLLMEvaluator.evaluate(example as any);
    },
  });
}
