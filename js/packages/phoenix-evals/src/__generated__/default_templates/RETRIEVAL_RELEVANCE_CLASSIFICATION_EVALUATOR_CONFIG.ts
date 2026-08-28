// This file is generated. Do not edit by hand.

import type { ClassificationEvaluatorConfig } from "../types";

export const RETRIEVAL_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG: ClassificationEvaluatorConfig = {
  name: "retrieval_relevance",
  description: "Determine whether the external information retrieved during a step is relevant to the request it was serving, regardless of the source (vector search, tool call, MCP server, or web search).",
  optimizationDirection: "MAXIMIZE",
  template: [
    {
      role: "user",
      content: `
You are an expert evaluator judging whether externally retrieved information is RELEVANT to the request it was meant to serve.

The request is everything that defines what the retrieval needed to satisfy: the user's question or task, and any earlier turns or context needed to interpret it. The retrieved information is everything that came back from the retrieval step — a vector/semantic search, a tool or function call, an MCP server, a web search, or a database query — regardless of how it is formatted (plain text, structured data, or a rendered result). Treat all sources the same way: you are judging the retrieved information as a whole against the request, not judging the source's general trustworthiness.

<rubric>

RELEVANT - The retrieved information contains content that materially helps address the request. This includes when it:

- Directly answers the request, or
- Provides facts, data, or context needed to answer the request, or
- Is on-topic and useful even if it only partially covers the request, or is mixed with some unrelated material, or
- Is accurate as of a different time, superseded, or later contradicted, as long as it was genuinely about the entity/topic the request concerns.


IRRELEVANT - The retrieved information does NOT contain content that helps address the request. This includes when it:

- Is about a different topic, entity, or time period than the request asks about, or
- Is only superficially or tangentially related — e.g. shares a keyword but not the substance of the request — and does not help answer it, or
- Is empty, an error, a timeout, or a "no results found" response, or

</rubric>

Apply these rules when deciding:

1. Partial relevance is enough. If any meaningful part of the retrieved information bears on the request, the whole retrieval step is RELEVANT — even if most of the content is unrelated or unused.
2. Relevance is not correctness. Judge only whether the information bears on the request's topic, not whether it is accurate, current, or complete. Wrong, outdated, or later-contradicted information is still RELEVANT if it was genuinely about the right subject.
3. A failed retrieval is not relevant. An error, timeout, or empty result provides no usable content, so it is IRRELEVANT — regardless of whether the underlying lookup, if it had succeeded, would have been on-topic.
4. Judge the retrieved information as a whole. Do not require every sentence or every retrieved item to be relevant individually; ask whether the set collectively contains something useful.
5. Superficial topical overlap is not enough. Sharing an entity name, keyword, or category with the request does not make information relevant if it doesn't actually address what the request needed.


<data>

<request>
{{input}}
</request>

<retrieved_information>
{{context}}
</retrieved_information>

</data>

Work through the retrieved information piece by piece, checking each part against the request, before you decide. Is the retrieved information relevant or irrelevant?
`,
    },
  ],
  choices: {
  "relevant": 1,
  "irrelevant": 0
},
};