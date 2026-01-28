// This file is generated. Do not edit by hand.

import type { ClassificationEvaluatorConfig } from "../types";

export const CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG: ClassificationEvaluatorConfig = {
  name: "correctness",
  description: "Assess factual accuracy and completeness of model outputs.",
  optimizationDirection: "MAXIMIZE",
  template: [
    {
      role: "user",
      content: `
You are an expert evaluator labeling model outputs for correctness. Your task is to assign a classification based on the following criteria:

<rubric>

CORRECT - The response:

- Provides accurate and complete information with no factual errors
- Addresses all parts of the question
- Is logically consistent with no contradictions
- Uses precise, domain-appropriate terminology
- Avoids ambiguous or misleading language


INCORRECT - The response contains any of:

- Factual errors or inaccuracies
- Incomplete or partial answers
- Misleading or ambiguous statements
- Incorrect terminology
- Logical inconsistencies
- Missing key information

</rubric>


<data>

<input>
{{input}}
</input>

<output>
{{output}}
</output>

</data>

Carefully read the input and output and check for factual accuracy and completeness. Focus on correctness of information rather than verboseness or style.

Is the output correct or incorrect?
`,
    },
  ],
  choices: {
  "correct": 1,
  "incorrect": 0
},
};