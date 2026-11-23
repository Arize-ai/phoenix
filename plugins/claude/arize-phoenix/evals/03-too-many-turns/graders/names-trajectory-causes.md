---
type: llm
focus: last_message
weight: 0.5
---
The user's agent takes 30+ LLM calls to answer trivial questions with no errors, and asked what to run with the `px` CLI and what to look for. This is a trajectory problem: the answer lives in the sequence and contents of the spans, not in status codes.

Grade exactly one claim. PASS if the claim below holds for the response, FAIL otherwise. Ignore everything else about the response.

Claim: The response names at least two concrete trajectory-level causes to look for, such as: the same tool called repeatedly with the same or near-identical arguments; the model re-planning or re-asking instead of answering; a system prompt that forces tool use or forbids answering directly; a tool output too large or malformed to act on; a missing tool or skill so the agent flails.
