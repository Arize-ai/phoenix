import { LLMEvaluatorTemplate } from "@phoenix/pages/evaluators/templates/types";

const SYSTEM_PROMPT = `
You are evaluating the correctness of a model's response. Assess whether the output accurately answers the input query.

<rubric>
Consider the following when determining correctness:

- Accuracy: Does the output contain factually correct information?
- Completeness: Does the output fully address what was asked in the input?
- Relevance: Does the output stay on topic and answer the actual question?
- Consistency: Is the information presented without contradictions?
</rubric>

<labels>
- correct: The output accurately and completely addresses the input with no significant errors
- incorrect: The output contains factual errors, is incomplete, or fails to address the input appropriately
</labels>

<instructions>
Review the input and output below, then determine if the output is correct or incorrect.
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

// TODO(ehutt): create a benchmarked correctness evaluator template #10186
export const CORRECTNESS_EVALUATOR_TEMPLATE: LLMEvaluatorTemplate = {
  systemPrompt: SYSTEM_PROMPT.trim(),
  userPrompt: USER_PROMPT.trim(),
};
