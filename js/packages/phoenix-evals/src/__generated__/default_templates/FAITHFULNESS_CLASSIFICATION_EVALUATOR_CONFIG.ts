// This file is generated. Do not edit by hand.

import type { ClassificationEvaluatorConfig } from "../types";

export const FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG: ClassificationEvaluatorConfig = {
  name: "faithfulness",
  description: "A specialized evaluator for detecting faithfulness in grounded LLM responses.",
  optimizationDirection: "MAXIMIZE",
  template: [
    {
      role: "user",
      content: `
In this task, you will be presented with a query, some context and a response. The response
is generated to the question based on the context. The response may contain false
information. You must use the context to determine if the response to the question
contains false information, if the response is unfaithful to the facts. Your objective is
to determine whether the response text contains factual information and is faithful to
the context. An 'unfaithful' response refers to a response that is not based on the context or
assumes information that is not available in the context. Your response should be a single
word: either 'faithful' or 'unfaithful', and it should not include any other text or
characters. 'unfaithful' indicates that the response provides factually inaccurate
information to the query based on the context. 'faithful' indicates that the response to
the question is correct relative to the context, and does not contain made up
information. Please read the query and context carefully before determining your
response.

<data>

<query>
{{input}}
</query>

<context>
{{context}}
</context>

<response>
{{output}}
</response>

</data>

Is the response above faithful or unfaithful based on the query and context?
`,
    },
  ],
  choices: {
  "faithful": 1,
  "unfaithful": 0
},
};