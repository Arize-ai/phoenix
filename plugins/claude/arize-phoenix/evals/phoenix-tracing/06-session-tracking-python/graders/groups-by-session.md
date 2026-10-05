---
type: llm
focus: {source: file, path: session_tracing.py}
weight: 0.5
---
The user wants all turns of one conversation grouped as a single Phoenix session (not one trace per turn).

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: A stable session id identifies the conversation and is propagated so that ALL spans of every turn share it — e.g. by wrapping each turn's work in `using_session(session_id)` so the LLM span and tool spans inherit it. Setting the session id on only one span per turn (e.g. `span.set_attribute(SESSION_ID, ...)` on a single span while sibling/child spans get nothing), or generating a new id per turn, fails this claim.
