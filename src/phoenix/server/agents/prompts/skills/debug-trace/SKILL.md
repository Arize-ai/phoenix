---
name: debug-trace
description: >
  Diagnose failure modes by systematically investigating traces. Trigger when the user explicitly asks for cross-trace diagnosis: "what's going wrong?", "were there errors?", "debug this", "where is my agent struggling?". Do NOT trigger on: (1) advice questions ("what should I do?"), (2) statistical questions ("what's the average latency?"), (3) summarize requests, (4) trace filtering ("show me traces with errors"), (5) vague questions ("is there a problem?"), (6) unrelated requests.
summary: Investigate traces to identify concrete failure modes, likely root causes, and prioritized fixes.
---

### Orientation

Your goal is to identify common failure modes and provide prioritized, actionable recommendations. If you already have a specific trace in context, skip the Steps below — apply the failure mode checklist directly to that trace and report findings. Otherwise, build a representative picture across multiple traces: start broad, inspect selectively, and stop once the main issue categories are clear.

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

Default query budget: 1–3 orientation queries, 3–5 aggregate or sampling queries, 3–7 targeted drilldowns. Avoid more than 20 GraphQL calls without summarizing progress. Avoid reading more than 5–10 full span inputs or outputs. Prefer fewer, richer queries — use GraphQL aliases to batch independent lookups. Use available GraphQL recipes before writing new queries.

1. **Orient** — Read `/phoenix/agent-start.md`. Use the `phoenix-gql` CLI to get a compact project overview in one aliased query: trace count, span count, latency quantiles, token totals, annotation names, slow traces, high-token traces, error spans.

2. **Select** — Choose a representative sample. Prioritize slow traces, high-token traces, and errored traces; include a few normal traces for comparison. Prefer diversity over volume.

3. **Open-code** — For each trace, write free-form notes on problems, surprises, and incorrect behaviors. Focus on the first failure in a trace, since upstream errors often cause downstream issues. Note independent downstream failures only when they reveal a separate root cause.

4. **Axial-code** — Cluster your notes into named failure categories. Let categories emerge from the data. Distinguish exact counts from sampled or estimated counts.

5. **Summarize** — Report findings using the output format below.

### Observation Journal

Output this table inline in the conversation as you work — it stays compact by design and needs to be visible for axial-coding. Only write it to a file if the user asks for exhaustive analysis across a large number of traces.

For each inspected trace, add a row. Keep `observations` free-form. Fill in `tentative_category` only when the pattern is clear — leave it blank otherwise.

| trace_id | observations | tentative_category |
| -------- | ------------ | ------------------ |

Use this journal as the input to axial-coding.

### Output Format

- **Analysis scope** — brief summary of what was analyzed: number of traces examined, time range if relevant, any filters applied
- **Findings table** — one row per issue category with: label, short description, occurrence count, one or two representative span (or trace) links — see Linking to Findings below
- **Recommendations** — for each issue, a concrete suggested fix (prompt change, parameter adjustment, tool fix, instrumentation improvement, etc.), if one can be identified

### Linking to Findings

Prefer linking to the specific span that exhibits the issue over the parent trace whenever possible — span links land the user on the exact node, while a trace link forces them to hunt for the relevant span. Fall back to a trace link only when no single span captures the issue (e.g., a trajectory problem spanning many spans).

Use Phoenix's root-relative redirect URLs with the OpenTelemetry IDs returned by GraphQL — no project lookup required. Read the hex OTel IDs from `Span.spanId` and `Trace.traceId`, **not** the `id` field (which is a Relay node ID and will not resolve). A `Span` has no `traceId` field — read it via the nested `trace { traceId }`:

- Span: `[short description](/redirects/spans/<spanId>)`
- Trace: `[short description](/redirects/traces/<traceId>)`

### Caveats and Pitfalls

- Existing evals and annotations are useful signal, but treat them as one input among many — they may be incomplete or incorrect.
- Span status codes are not a reliable proxy for whether an error actually occurred. An exception in the output may be expected behavior; a success status code may mask an error message buried in the span attributes.
- Do not overload your context by reading too many full spans. Read enough to support meaningful recommendations, then stop.
