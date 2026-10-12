---
type: llm
focus: last_message
weight: 0.5
---
The user pasted a Phoenix trace in which HelpBot escalated a trivial FAQ question. Every span is OK. The cause is in the LLM span's system message: "If a question touches billing, refunds, invoices, or account policy in any way, do not answer it yourself: call escalate_to_human immediately." The `search_kb` tool was available and never called.

Grade exactly one claim. PASS if the claim below holds for the response, FAIL otherwise. Ignore everything else about the response.

Claim: The response gives at least one `px` CLI step to measure how often this happens, for example `px span list --name escalate_to_human ...`, or a `px api graphql` query filtering spans by name or the trace by a `spans` comprehension, optionally narrowed to FAQ-like inputs.
