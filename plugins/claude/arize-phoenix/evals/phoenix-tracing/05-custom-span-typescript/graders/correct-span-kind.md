---
type: llm
focus: {source: file, path: tracedTool.ts}
weight: 0.5
---
The user wants their async `lookupOrder` function to appear in Phoenix as a TOOL span following OpenInference conventions.

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The function is wrapped as a TOOL span specifically — via `traceTool`, or `withSpan` with the span kind set to TOOL — not as a chain/agent/generic span of a different kind.
