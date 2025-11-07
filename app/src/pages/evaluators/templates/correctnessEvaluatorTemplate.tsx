import { generateMessageId, PlaygroundChatTemplate } from "@phoenix/store";

// TODO(ehutt): create a benchmarked correctness evaluator template
export const CORRECTNESS_EVALUATOR_TEMPLATE: Readonly<PlaygroundChatTemplate> =
  {
    __type: "chat",
    messages: [
      {
        id: generateMessageId(),
        role: "user",
        content: `You are evaluating the correctness of a model's response. Assess whether the output accurately answers the input query.

<criteria>
Consider the following when determining correctness:

- Accuracy: Does the output contain factually correct information?
- Completeness: Does the output fully address what was asked in the input?
- Relevance: Does the output stay on topic and answer the actual question?
- Consistency: Is the information presented without contradictions?
</criteria>

<scoring>
- correct: The output accurately and completely addresses the input with no significant errors
- incorrect: The output contains factual errors, is incomplete, or fails to address the input appropriately
</scoring>

<task>
Review the input and output below, then determine if the output is correct or incorrect.
</task>

<input>
{{input}}
</input>

<output>
{{output}}
</output>
`,
      },
    ],
  };
