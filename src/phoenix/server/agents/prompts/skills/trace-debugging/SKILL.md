---
name: trace-debugging
description: >
  Use when the user wants to know what is going wrong with their LLM application or how to improve it — e.g., "what's wrong?", "were there errors?", "where is my agent struggling?", "is retrieval working?", "debug this". Do NOT trigger for general project understanding or trace filtering requests like "show me traces with errors", "describe the trace structure", or "tell me about this project" — those don't require cross-trace diagnosis. This skill samples traces, journals observations (open-coding), clusters them into failure categories (axial coding), and produces a findings report with recommendations.
---

### Orientation

Your goal is to identify common failure modes across multiple traces and provide prioritized, actionable recommendations. You are not trying to exhaustively read every trace — you are trying to build a representative picture of what is going wrong and why.

### Common Failure Modes to Watch For

This list is non-exhaustive. Use it as a starting checklist, not a complete taxonomy.

- **Explicit errors** — exceptions, error status codes, or error messages in tool call spans, LLM spans, or retriever spans
- **Cost and latency** — unusually high token counts or slow spans that suggest room for efficiency improvements
- **Retrieval quality** — irrelevant, missing, or low-scoring chunks in RAG applications
- **LLM response quality** — hallucination, factual incorrectness, wrong tone, inappropriate refusals
- **Tool use problems** — wrong tool selected, malformed invocation, or poor handling of the tool response
- **Trajectory problems** — the agent took an inefficient path, got stuck in a loop, or failed to complete its task
- **Instrumentation gaps** — the application is poorly traced, leaving visibility gaps that make it difficult to understand behavior

### Steps

1. **Orient** — Use the `phoenix-gql` CLI to pull a sample of traces and understand the project structure (span types present, typical trace shapes, time range).
2. **Select** — Determine which traces and spans to examine. Aim for a representative sample rather than exhaustive coverage. Be mindful of your context window.
3. **Open-code** — Write open-ended notes about individual traces, flagging problems, surprises, and incorrect behaviors. Focus on the first failure in each trace, since upstream errors often cause downstream issues. Tag independent downstream failures if feasible.
4. **Axial-code** — Cluster your notes. Let failure categories emerge naturally. Count occurrences per category.
5. **Summarize** — Report findings to the user using the output format below.

### Output Format

- **Analysis scope** — brief summary of what was analyzed: number of traces examined, time range if relevant, any filters applied
- **Findings table** — one row per issue category with: label, short description, occurrence count, one or two representative trace links
- **Recommendations** — for each issue, a concrete suggested fix (prompt change, parameter adjustment, tool fix, instrumentation improvement, etc.), if one can be identified

### Caveats and Pitfalls

- Existing evals and annotations are useful signal, but treat them as one input among many — they may be incomplete or incorrect.
- Span status codes are not a reliable proxy for whether an error actually occurred. An exception in the output may be expected behavior; a success status code may mask an error message buried in the span attributes.
- Do not overload your context by reading too many full spans. Read enough to support meaningful recommendations, then stop.
