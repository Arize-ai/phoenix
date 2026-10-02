---
type: llm
focus: last_message
weight: 0.5
---
The user asked to instrument a Python OpenAI app so its LLM calls are traced to Phoenix.

Grade exactly one claim. PASS if the claim below holds for the response, FAIL otherwise. Ignore everything else about the response.

Claim: The response tells the user how to verify it worked — e.g. run the app and then look for the traces/spans in the Phoenix UI (the project view). A vague "it will now be traced" with no verification step fails this claim.
