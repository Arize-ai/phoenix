// This file is generated. Do not edit by hand.

import type { PromptTemplate } from "../../types/templating";

export const DOCUMENT_RELEVANCE_TEMPLATE: PromptTemplate = [
  {
    role: "user",
    content: `
You are comparing a document to a question and trying to determine
if the document text contains information relevant to answering the
question. Here is the data:

[BEGIN DATA]
************
[Question]: {{input}}
************
[Document text]: {{documentText}}
************
[END DATA]

Compare the question above to the document text. You must determine
whether the document text contains information that can answer the
question. Please focus on whether the very specific question can be
answered by the information in the document text. Your response must be
either "relevant" or "unrelated". "unrelated" means that the document
text does not contain an answer to the question. "relevant" means the
document text contains an answer to the question.`,
  },
];

export const DOCUMENT_RELEVANCE_CHOICES = {
  "relevant": 1,
  "unrelated": 0
};

export const DOCUMENT_RELEVANCE_OPTIMIZATION_DIRECTION = "MAXIMIZE";