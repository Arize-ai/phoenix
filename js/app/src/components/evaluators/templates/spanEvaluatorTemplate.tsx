import type { LLMEvaluatorTemplate } from "@phoenix/components/evaluators/templates/types";
import type { ClassificationEvaluatorAnnotationConfig } from "@phoenix/types";

const SYSTEM_PROMPT = `
First, describe the persona of your evaluator (e.g. "You are an expert at evaluating the quality of an LLM application's responses").

<rubric>
Provide bullet points for how the LLM should score both good and bad responses, e.g.:
A good response:
- Directly addresses the request in the input
- etc.

A bad response:
- Ignores or contradicts the request in the input
- etc.
</rubric>

<instructions>
Provide instructions for how the LLM should process the example, e.g.:
- Read the input to understand what was asked
- Judge whether the output satisfies the request
- etc.
</instructions>

<reminder>
Provide any remaining important reminders for the LLM to keep in mind while grading, e.g.:
- Judge only what is present in the input and output
</reminder>
`;

const USER_PROMPT = `
<input>
{{input}}
</input>

<output>
{{output}}
</output>
`;

const DEFAULT_OUTPUT_CONFIG: ClassificationEvaluatorAnnotationConfig = {
  name: "score",
  optimizationDirection: "MAXIMIZE",
  values: [
    { label: "true", score: 1 },
    { label: "false", score: 0 },
  ],
};

/**
 * A span evaluation context has no dataset `reference`, so this template
 * references only `input` and `output`.
 */
export const SPAN_EVALUATOR_TEMPLATE: LLMEvaluatorTemplate = {
  systemPrompt: SYSTEM_PROMPT.trim(),
  userPrompt: USER_PROMPT.trim(),
  outputConfigs: [DEFAULT_OUTPUT_CONFIG],
};
