// This file is generated. Do not edit by hand.

import type { ClassificationEvaluatorConfig } from "../types";

export const HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG: ClassificationEvaluatorConfig = {
  name: "hallucination",
  description: "Detect whether an assistant response contains hallucinations — claims not supported by the conversation.",
  optimizationDirection: "MINIMIZE",
  template: [
    {
      role: "user",
      content: `
You are an expert evaluator labeling whether an AI assistant's response contains hallucinations. A hallucination is any claim in the response that is not supported by, or that contradicts, the information available in the conversation.

The conversation contains what the assistant had access to when responding: earlier user and assistant turns, tool calls, tool results, and any retrieved context. Treat it as the source of truth. It may contain markers such as "[... N earlier messages omitted ...]" or "...[truncated]..." indicating that content was elided to fit a length limit. Do not treat elided content as missing or as evidence of fabrication; judge only the claims you can actually check against the visible conversation.

<rubric>

HALLUCINATED - The response does any of the following:

- States facts that contradict the conversation
- Asserts specific details (names, numbers, dates, quotes, entities, tool results, or events) that are not present in and cannot be reasonably derived from the conversation
- Attributes claims, sources, or actions to the conversation that never appear in it

FACTUAL - The response:

- Makes only claims that are supported by, consistent with, or reasonably inferable from the conversation
- Relies on uncontroversial general knowledge that does not conflict with the conversation
- Declines to answer, expresses uncertainty, or asks a clarifying question without asserting unsupported facts

</rubric>

You are evaluating ONLY hallucination. Do NOT judge helpfulness, completeness, relevance, tone, or writing style. A response can be unhelpful or off-topic and still be factual, and a fluent, confident-sounding response can still be hallucinated.

<data>

<conversation>
{{conversation}}
</conversation>

<input>
{{input}}
</input>

<output>
{{output}}
</output>

</data>

The input is the latest user message the response is answering. Carefully compare each factual claim in the output against the conversation and reason about whether it is supported before deciding. When the response asserts specifics that the conversation does not support, label it hallucinated.

Is the response above factual or hallucinated based on the conversation?
`,
    },
  ],
  choices: {
  "hallucinated": 1,
  "factual": 0
},
};