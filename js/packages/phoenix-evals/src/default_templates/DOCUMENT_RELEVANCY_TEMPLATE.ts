import { PromptTemplate } from "../types";

export const DOCUMENT_RELEVANCY_TEMPLATE: PromptTemplate = [
  {
    role: "user",
    content: `
You are comparing a document to a question and trying to determine if the document text
contains information relevant to answering the question. Here is the data:

    [BEGIN DATA]
    ************
    [Question]: {{input}}
    ************
    [Document text]: {{documentText}}
    ************
    [END DATA]

Compare the Question above to the Document text. You must determine whether the Document text
contains information that can answer the Question. Please focus on whether the very specific
question can be answered by the information in the Document text.
Your response must be single word, either "relevant" or "unrelated",
and should not contain any text or characters aside from that word.
"unrelated" means that the document text does not contain an answer to the Question.
"relevant" means the document text contains an answer to the Question.
`,
  },
];

export const DOCUMENT_RELEVANCY_CHOICES = {
  relevant: 1,
  unrelated: 0,
};
