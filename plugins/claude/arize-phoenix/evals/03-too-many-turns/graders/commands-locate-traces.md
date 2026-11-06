---
type: llm
focus: last_message
weight: 0.5
---
The user's agent takes 30+ LLM calls to answer trivial questions with no errors, and asked what to run with the `px` CLI and what to look for. This is a trajectory problem: the answer lives in the sequence and contents of the spans, not in status codes.

Grade exactly one claim. PASS if the claim below holds for the response, FAIL otherwise. Ignore everything else about the response.

Claim: The response gives real, runnable `px` commands to locate the offending traces, for example `px trace list ... --format raw --no-progress | jq 'sort_by(-.duration)'` or a filter on `latency_ms`, and then `px trace get <id> --format raw` (or `px span list --trace-id <id>`) to open one.
