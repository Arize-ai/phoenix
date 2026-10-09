---
type: llm
focus: {source: file, path: test_faithfulness.py}
weight: 0.5
---
The file is a pytest suite that should gate CI on a RAG bot's faithfulness and also enforce a couple of hard invariants (non-empty response, valid JSON).

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The suite treats the two concerns differently, following the invariants-vs-signals split. The hard invariants (non-empty response, valid JSON) are asserted so any violation fails CI immediately. The faithfulness signal (an LLM judge) is recorded per case with `log_evaluation`/`evaluate` (or an equivalent logged signal) and is NOT asserted on every individual case; gating on faithfulness is left to a separate aggregate/trend mechanism (a nightly threshold, `run_experiment`, or an explicit aggregate check over the collected scores) rather than a per-case assert. A suite that asserts `faithful == True` on every case FAILS this claim.
