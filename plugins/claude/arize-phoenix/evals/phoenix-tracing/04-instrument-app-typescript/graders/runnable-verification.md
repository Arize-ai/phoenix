---
type: llm
focus: last_message
weight: 0.5
---
The user asked to instrument a TypeScript OpenAI app so its LLM calls are traced to Phoenix.

Grade exactly one claim. PASS if the claim below holds for the response, FAIL otherwise. Ignore everything else about the response.

Claim: The response tells the user how to verify it worked — e.g. that the instrumentation file must be imported/loaded before the app code, then run the app and look for traces in the Phoenix UI. A bare "this traces it" with no verification or load-order note fails this claim.
