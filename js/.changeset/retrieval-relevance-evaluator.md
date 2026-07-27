---
"@arizeai/phoenix-evals": minor
---

Add a built-in retrieval relevance evaluator (createRetrievalRelevanceEvaluator) that checks whether the external information retrieved during a step is relevant to the request it was serving. Unlike document relevance, it is source-agnostic and scores the retrieved information holistically, whether it came from a vector search, a tool or MCP call, a web search, or content embedded in an LLM turn.
