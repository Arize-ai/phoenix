// This file is generated. Do not edit by hand.

import type { ClassificationEvaluatorConfig } from "../types";

export const QA_CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG: ClassificationEvaluatorConfig = {
  name: "qa_correctness",
  description: "Determine whether an answer correctly and completely answers a question based on a reference text.",
  optimizationDirection: "MAXIMIZE",
  template: [
    {
      role: "user",
      content: `
You are an expert evaluator judging whether an answer correctly and completely answers a question, using the reference text as the source of truth.

<rubric>

CORRECT - The answer:

- Correctly and fully answers the question
- Is consistent with, and supported by, the reference text
- Contains no factual errors relative to the reference

INCORRECT - The answer does any of the following:

- Does not answer the question, or answers a different question
- Answers only partially, or omits key information the question asks for
- Contradicts the reference text or contains factual errors relative to it
- Makes claims that the reference text does not support

</rubric>

You are judging ONLY whether the question is correctly and completely answered based on the reference. Do NOT reward or penalize style, length, or tone, and do not penalize extra information that does not affect correctness. When the reference does not contain enough information to answer the question, an answer that fabricates a response is incorrect, while an answer that correctly states the information is unavailable is correct.

<data>

<question>
{{input}}
</question>

<reference>
{{reference}}
</reference>

<answer>
{{output}}
</answer>

</data>

Carefully compare the answer against the question and the reference before deciding. Is the answer correct or incorrect?
`,
    },
  ],
  choices: {
  "correct": 1,
  "incorrect": 0
},
};