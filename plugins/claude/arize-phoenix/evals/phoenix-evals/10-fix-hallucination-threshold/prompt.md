---
max_turns: 12
timeout_seconds: 300
allowed_tools: [Skill, Read, Write]
runs: 3
tags: [phoenix-evals]
---
My hallucination check for our RAG bot crashes with a TypeError on the `.mean()` line, and I'm not convinced the threshold logic is right either. `df` is an exported dataframe with `input` (the user question), `output` (the bot's answer), and `context` (the retrieved documents) columns. The batch should fail when more than 20% of the answers aren't supported by the retrieved documents.

```python
from phoenix.evals import HallucinationEvaluator, LLM, evaluate_dataframe

llm = LLM(provider="openai", model="gpt-4o")
hallucination = HallucinationEvaluator(llm=llm)

results_df = evaluate_dataframe(dataframe=df, evaluators=[hallucination])
score = results_df["hallucination_score"].mean()
if score < 0.8:
    raise SystemExit(f"too many hallucinations: {score:.2f}")
```

Fix it and save it as `hallucination_check.py`.
