import type { LLMEvaluatorTemplate } from "@phoenix/components/evaluators/templates/types";
import type { ClassificationEvaluatorAnnotationConfig } from "@phoenix/types";

const SYSTEM_PROMPT = `
Describe your evaluator's persona, e.g. "You are an expert at evaluating the correctness of a model's response".

<rubric>
A correct answer matches the reference answer.
An incorrect answer differs from the reference answer.
</rubric>

<instructions>
Find the facts in the reference answer and in the provided answer, then judge whether they agree. Different words with the same meaning are the same.
</instructions>
`;

const USER_PROMPT = `
<reference_answer>
{{reference}}
</reference_answer>

<provided_answer>
{{output}}
</provided_answer>
`;

const DEFAULT_OUTPUT_CONFIG: ClassificationEvaluatorAnnotationConfig = {
  name: "score",
  optimizationDirection: "MAXIMIZE",
  values: [
    { label: "true", score: 1 },
    { label: "false", score: 0 },
  ],
};

export const DEFAULT_EVALUATOR_TEMPLATE: LLMEvaluatorTemplate = {
  systemPrompt: SYSTEM_PROMPT.trim(),
  userPrompt: USER_PROMPT.trim(),
  outputConfigs: [DEFAULT_OUTPUT_CONFIG],
};
