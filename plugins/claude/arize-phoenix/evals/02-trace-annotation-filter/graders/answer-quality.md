---
type: llm
focus: last_message
weight: 1
---
The user wants the spans of every trace carrying a trace-level annotation named `quality` with label `poor`. Score against these claims; each must hold for a pass.

1. The response gives a runnable `px api graphql` command in a code block.
2. The filter in that query reaches the annotation through `trace_annotations["quality"]` (the trace-level accessor), not through `annotations["quality"]` or `evals["quality"]`, which would look at span-level annotations and silently match nothing.
3. The query returns spans (a `spans(...)` selection with span fields such as `name`, `spanId`, or attributes), not just trace ids.
4. The response explains, in a sentence or two, that the accessor picks the level the annotation was written at, so using the span-level accessor for a trace-level annotation returns no rows rather than an error.
5. The primary path is the `px` CLI. Recommending the SDK, curl, or the web UI as the main answer fails this claim.
