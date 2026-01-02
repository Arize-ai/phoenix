import { LLMEvaluatorTemplate } from "@phoenix/components/evaluators/templates/types";
import type { ClassificationEvaluatorAnnotationConfig } from "@phoenix/types";

const SYSTEM_PROMPT = `
First, describe the persona of your evaluator (e.g. "You are an expert at evaluating the correctness of a model's response").

<rubric>
Provide bullet points for how the LLM should score both correct and incorrect examples, e.g.:
A correct answer:
- Matches the reference answer exactly
- etc.

An incorrect answer:
- Differs from the reference answer
- etc.
</rubric>

<instructions>
Provide instructions for how the LLM should process the example, e.g.:
- Find all facts in the reference answer and provided answer
- etc.
</instructions>

<reminder>
Provide any remaining important reminders for the LLM to keep in mind while grading, e.g.:
- Different words with the same semantic meaning are the same
</reminder>
`;

const USER_PROMPT = `
<reference_answer>
{{expected}}
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
  outputConfig: DEFAULT_OUTPUT_CONFIG,
};
