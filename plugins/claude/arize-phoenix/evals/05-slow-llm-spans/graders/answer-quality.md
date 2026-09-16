---
type: llm
focus: last_message
weight: 1
---
The user wants one row per trace, with the trace id, for traces in project `checkout-agent` that contain an LLM span slower than 5 seconds. Score against these claims; each must hold for a pass.

1. The response gives a runnable `px api graphql` command. Since no `px` list flag can filter on the latency of a span inside a trace, GraphQL is the right tool; a response that tries to do this with `px span list --span-kind LLM` alone and no way to get back to whole traces fails this claim.
2. The trace-level filter is expressed with `traceFilterCondition` and a comprehension over `spans` checking `span.span_kind == "LLM"` and `span.latency_ms > 5000`.
3. The query yields one row per trace. The accepted way is a span-level `filterCondition: "parent_id is None"` alongside the trace filter. `rootSpansOnly: true` is deprecated and does not satisfy this claim; a jq `unique_by` over trace ids is an acceptable fallback.
4. The query targets the `checkout-agent` project explicitly (`getProjectByName(name: "checkout-agent")`, `--project checkout-agent`, or equivalent), not an arbitrary `projects(first: 1)`.
5. The selection includes the trace id (`trace { traceId }` or similar).
