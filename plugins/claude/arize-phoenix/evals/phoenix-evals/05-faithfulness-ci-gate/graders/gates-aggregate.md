---
type: llm
focus: {source: file, path: test_faithfulness.py}
weight: 0.5
---
The file is a pytest suite that should gate CI on a RAG bot's faithfulness and also enforce a couple of hard invariants (non-empty response, valid JSON).

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The suite treats the two concerns differently. The hard invariants are asserted so any violation fails CI immediately. The faithfulness signal (an LLM judge) is gated on an aggregate / threshold (e.g. mean faithfulness over the cases must stay above some bound) rather than asserting that every individual LLM-judged case must pass. A suite that simply asserts `faithful == True` on every case fails this claim.
