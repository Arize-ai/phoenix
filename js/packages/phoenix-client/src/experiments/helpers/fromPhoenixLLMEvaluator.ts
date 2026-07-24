import type { LLMEvaluator } from "@arizeai/phoenix-evals";

import type { Evaluator } from "../../types/experiments";
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
    evaluate: (example) => {
      // For now blindly coerce the types
      // oxlint-disable-next-line typescript/no-explicit-any, typescript/no-unsafe-type-assertion -- bridging phoenix-evals evaluator params to the experiment evaluator shape
      return phoenixLLMEvaluator.evaluate(example as any);
    },
  });
}
