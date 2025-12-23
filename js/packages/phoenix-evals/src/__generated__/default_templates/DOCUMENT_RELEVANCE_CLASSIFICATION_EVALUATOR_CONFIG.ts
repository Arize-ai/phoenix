// This file is generated. Do not edit by hand.

import type { ClassificationEvaluatorConfig } from "../types";

export const DOCUMENT_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG: ClassificationEvaluatorConfig = {
  name: "document_relevance",
  description: "A specialized evaluator for determining document relevance to a given question.",
  optimizationDirection: "MAXIMIZE",
  template: [
    {
      role: "user",
      content: `
You are comparing a document to a question and trying to determine if the document text contains information relevant to answering the question. Here is the data:

<data>
<question>
{{input}}
</question>
<document_text>
{{documentText}}
</document_text>
</data>

Compare the question above to the document text. You must determine whether the document text contains information that can answer the question. Please focus on whether the very specific question can be answered by the information in the document text. Your response must be either "relevant" or "unrelated". "unrelated" means that the document text does not contain an answer to the question. "relevant" means the document text contains an answer to the question.
`,
    },
  ],
  choices: {
  "relevant": 1,
  "unrelated": 0
},
};