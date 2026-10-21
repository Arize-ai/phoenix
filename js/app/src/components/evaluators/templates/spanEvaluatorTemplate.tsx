import type { LLMEvaluatorTemplate } from "@phoenix/components/evaluators/templates/types";
import type { ClassificationEvaluatorAnnotationConfig } from "@phoenix/types";

const SYSTEM_PROMPT = `
Describe your evaluator's persona, e.g. "You are an expert at evaluating the quality of an LLM application's responses".

<rubric>
A good response directly addresses the request in the input.
A bad response ignores or contradicts the request in the input.
</rubric>

<instructions>
Read the input to understand what was asked, then judge whether the output satisfies it. Judge only what is present in the input and output.
</instructions>
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
