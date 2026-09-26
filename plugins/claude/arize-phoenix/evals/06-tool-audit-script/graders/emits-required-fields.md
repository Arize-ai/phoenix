---
type: llm
focus: {source: file, path: tool-audit.sh}
weight: 0.5
---
You are looking at a bash script that should print every TOOL span of a Phoenix trace as JSON, including spans whose status is OK.

Grade exactly one claim. PASS if the claim below holds for the response, FAIL otherwise. Ignore everything else about the response.

Claim: For each tool span it emits the span `name`, its `status_code`, and the tool input and output read from `.attributes["input.value"]` and `.attributes["output.value"]` (or equivalent paths). Reading a field that does not exist in the trace JSON, such as `.tool.parameters` at the span top level or `.input` without `.value`, fails this claim.
