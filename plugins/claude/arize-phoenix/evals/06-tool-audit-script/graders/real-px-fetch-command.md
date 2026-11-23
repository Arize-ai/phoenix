---
type: llm
focus: {source: file, path: tool-audit.sh}
weight: 0.5
---
You are looking at a bash script that should print every TOOL span of a Phoenix trace as JSON, including spans whose status is OK.

Grade exactly one claim. PASS if the claim below holds for the response, FAIL otherwise. Ignore everything else about the response.

Claim: It fetches the trace's spans with a real `px` command: either `px trace get "$1"` or `px span list --trace-id "$1"`, passing `--format raw` or `--format json` (a `--no-progress` flag or `--limit` is fine). Invented commands or flags such as `px spans get`, `px span get`, or `--output json` fail this claim. It does not hard-code a trace id or an endpoint URL; it relies on `PHOENIX_ENDPOINT` from the environment.
