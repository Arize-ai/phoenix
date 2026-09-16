---
type: llm
focus: last_message
weight: 1
---
The user wants sessions with more than 3 traces and at least one errored span. Score against these claims; each must hold for a pass.

1. The response confirms that `px session list` has no filter flag and routes the user to GraphQL via `px api graphql`, rather than inventing a flag or telling the user to page through `px session list` output by hand.
2. The GraphQL query uses `sessionFilterCondition` on a `sessions(...)` field.
3. The filter expression requires more than 3 traces (`num_traces > 3` or equivalent) AND at least one error (`num_traces_with_error > 0`, or a comprehension over `spans` checking `status_code == "ERROR"`).
4. The selection returns something that identifies each session (`sessionId` or `id`), so the user can act on the result.
5. The primary path is the `px` CLI. Recommending the SDK, curl, or the web UI as the main answer fails this claim.
