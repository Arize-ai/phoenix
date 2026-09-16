---
type: llm
focus: {source: file, path: triage.sh}
weight: 1
---
You are looking at a bash script that should print the errored spans of a Phoenix trace as JSON. Score against these claims; each must hold for a pass.

1. It is syntactically plausible bash with a shebang line, and it exits with a usage message when no trace id is supplied.
2. It fetches the trace with `px trace get "$1" --format raw` (a `--no-progress` flag is fine but not required) and does not hard-code a trace id.
3. It filters `.spans[]` (the trace JSON has a top-level `spans` array) down to spans whose `status_code` equals `"ERROR"`, using jq or equivalent. Filtering on a field that does not exist in the trace JSON, such as `.status` on a span or `.error`, fails this claim.
4. For each errored span it emits the span `name` and the `exception.message` attribute (read from `.attributes["exception.message"]` or equivalent path).
5. The output is JSON (objects or an array), not a table or free text.
6. It relies on `PHOENIX_ENDPOINT` from the environment rather than hard-coding an endpoint URL.
