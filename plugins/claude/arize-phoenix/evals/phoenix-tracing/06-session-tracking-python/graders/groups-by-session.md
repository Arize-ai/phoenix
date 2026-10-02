---
type: llm
focus: {source: file, path: session_tracing.py}
weight: 0.5
---
The user wants all turns of one conversation grouped as a single Phoenix session (not one trace per turn).

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: A stable session id identifies the conversation and is applied so that the turns/spans of that conversation share it (e.g. via `using_session(session_id)` wrapping each turn, so child spans inherit it) — not a different session id generated per turn.
