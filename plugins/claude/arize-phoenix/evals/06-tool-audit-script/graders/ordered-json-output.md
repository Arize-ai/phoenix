---
type: llm
focus: {source: file, path: tool-audit.sh}
weight: 0.5
---
You are looking at a bash script that should print every TOOL span of a Phoenix trace as JSON, including spans whose status is OK.

Grade exactly one claim. PASS if the claim below holds for the response, FAIL otherwise. Ignore everything else about the response.

Claim: It orders spans by `start_time` (or preserves the array order and says so) and the output is JSON, not a table or free text.
