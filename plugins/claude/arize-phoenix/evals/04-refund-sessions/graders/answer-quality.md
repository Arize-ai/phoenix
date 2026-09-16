---
type: llm
focus: last_message
weight: 1
---
The user wants sessions where "refund" appears anywhere in the conversation, plus each session's total token count. Score against these claims; each must hold for a pass.

1. The response gives a runnable `px api graphql` command using `sessionFilterCondition`.
2. The filter uses the containment form `'refund' in any_input` (optionally also `any_output`). It must not compare `any_input` or `any_output` with `==`, and it must not use `first_input` alone, since that only checks the first message.
3. The selection includes a token total field for each session (`tokenCountTotal`, or prompt and completion counts that add up to it).
4. The response returns something identifying each session (`sessionId` or `id`).
5. The primary path is the `px` CLI. Recommending the SDK, curl, or the web UI as the main answer fails this claim.
