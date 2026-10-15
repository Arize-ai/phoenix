---
type: llm
focus: {source: file, path: relevance_eval.py}
weight: 0.5
---
The user pasted a legacy phoenix-evals 1.0 script (it imported `OpenAIModel` and `llm_classify` and used `RAG_RELEVANCY_PROMPT_TEMPLATE` with a `rails=` argument) and asked to get it running again on the current 2.x API, saved as `relevance_eval.py`.

Grade exactly one claim. PASS if the claim below holds for the file, FAIL otherwise. Ignore everything else about the file.

Claim: The executable code uses only the 2.0 API and does not call or import the legacy 1.0 API — no `OpenAIModel`, `llm_classify`, `run_evals`, no `rails=` argument, and no import from `phoenix.evals.legacy` or `phoenix.evals.default_templates`. Mentioning, quoting, or mapping the old API inside comments or docstrings that document the migration does NOT count as a violation — only actual executable usage does.
